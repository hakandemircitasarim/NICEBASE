import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { X, Check, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import AiyaCharacter, { AiyaMood } from './AiyaCharacter'
import AiyaDemo from './AiyaDemo'
import { useStore } from '../store/useStore'
import { useUserId } from '../hooks/useUserId'
import { useBackButton } from '../hooks/useBackButton'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { hapticFeedback } from '../utils/haptic'
import { memoryService } from '../services/memoryService'
import { analyticsService } from '../services/analyticsService'
import { toLocalISODate } from '../utils/dateFormat'
import { generateUUID } from '../utils/uuid'

interface OnboardingProps {
  onComplete: () => void
}

// A tour step either spotlights a `[data-tour="<target>"]` element on `route`,
// or (no target / target missing) falls back to a centered card. The engine
// navigates between routes itself, so the tour walks the real app.
// `interactive` steps punch a tappable hotspot over the spotlight so the user
// can advance by tapping the highlighted control itself (navigateTo mirrors
// what tapping the real control would do).
type TourStep = {
  id: string
  route: string
  target?: string
  titleKey: string
  textKey: string
  mood: AiyaMood
  interactive?: boolean
  navigateTo?: string
  // 'seed'    → do-first step that creates the user's first memory in one tap.
  // 'aiyaDemo'→ a no-login taste of chatting with Aiya (centered, custom body).
  kind?: 'seed' | 'aiyaDemo'
}

// Trimmed to 5 focused steps (do-first): a warm intro, create the first memory,
// see where it lives (an interactive tap into the Vault), meet Aiya, then a
// celebratory activation finish. The old Vault-filters, Aiya-tab and Profile
// steps were dropped — they taught empty/secondary surfaces on a day-zero account.
const STEPS: TourStep[] = [
  { id: 'welcome', route: '/', titleKey: 'tourWelcomeTitle', textKey: 'tourWelcomeText', mood: 'wave' },
  { id: 'firstMemory', route: '/', titleKey: 'tourFirstMemoryTitle', textKey: 'tourFirstMemoryText', mood: 'happy', kind: 'seed' },
  { id: 'nav-vault', route: '/', target: 'nav-vault', titleKey: 'tourVaultTabTitle', textKey: 'tourVaultTabText', mood: 'point', interactive: true, navigateTo: '/vault' },
  // route '/vault' (NOT /aiya — that hits a login wall for guests): the tour
  // stays where the Vault tap landed, and Aiya introduces herself with a
  // scripted, no-login taste of the conversation over the (dimmed) Vault.
  { id: 'aiya', route: '/vault', titleKey: 'aiyaDemoTitle', textKey: 'aiyaDemoText', mood: 'happy', kind: 'aiyaDemo' },
  { id: 'finish', route: '/', titleKey: 'tourFinishTitle', textKey: 'tourFinishText', mood: 'excited' },
]

const SPOT_PADDING = 8
const TARGET_FIND_TIMEOUT = 3500
const TARGET_POLL_MS = 120
const TRACK_MS = 150
const CARD_MARGIN = 14
const CARD_EST_HEIGHT = 240 // used before the real card mounts + is measured
const MIN_CARD_TOP = 60 // keep below the Skip control
const TAIL = 7 // half the speech-bubble tail's diagonal

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const RESUME_KEY = 'onboardingStep'
const SEED_KEY = 'onboardingSeedDone'
// The id of the created seed memory — a STABLE identity that survives the user
// editing its text. Existence checks match this id OR the canned seed text (the
// text is the only signal for a memory created-then-app-killed before this was
// stored); relying on text alone would misfire once the user edits the memory.
const SEED_ID_KEY = 'onboardingSeedId'
const readSeedId = (): string | null => {
  try {
    return localStorage.getItem(SEED_ID_KEY)
  } catch {
    return null
  }
}
// Drop the resume marker once the tour is over (finished or skipped) so it never
// re-opens mid-tour.
const clearResumeMarker = () => {
  try {
    localStorage.removeItem(RESUME_KEY)
  } catch {
    /* ignore */
  }
}
// Persist the "completed" bit DURABLY the instant the tour starts closing, before
// the cosmetic fade-out defers onComplete (which flips the store flag) by ~240ms.
// Otherwise an app-kill inside that fade window would re-read completed=false with
// the resume marker already cleared, replaying the finished tour from step 0.
// (Key mirrors useStore's 'hasCompletedOnboarding'; onComplete re-persists it.)
const persistOnboardingComplete = () => {
  try {
    localStorage.setItem('hasCompletedOnboarding', 'true')
  } catch {
    /* ignore — onComplete's store setter will persist it at fade-end */
  }
}

// Measure the top safe-area inset (notch / status bar / Dynamic Island). Probes the
// app's RESOLVED `--safe-area-inset-top` — not raw env() — because capacitor.ts
// patches that variable on devices where env() reports 0 despite a real inset. 0 on
// web / non-notched. Called at mount, again shortly after (in case capacitor.ts's
// async patch lands late), and on every resize/orientationchange (rotation).
const probeSafeAreaTop = (): number => {
  if (typeof document === 'undefined') return 0
  try {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;top:0;left:0;height:var(--safe-area-inset-top, 0px);pointer-events:none;visibility:hidden'
    document.body.appendChild(probe)
    const h = probe.getBoundingClientRect().height
    document.body.removeChild(probe)
    return Number.isFinite(h) ? h : 0
  } catch {
    return 0
  }
}

type SpotRect = { top: number; left: number; width: number; height: number; radius: number }

// Reveal `text` character-by-character. Disabled (reduced motion / step still
// locating its target) → full text immediately. `complete` skips to the end.
// The untyped remainder is still laid out (rendered transparent by the caller)
// so the card never changes height mid-type.
function useTypewriter(text: string, enabled: boolean) {
  const [count, setCount] = useState(enabled ? 0 : text.length)

  useEffect(() => {
    if (!enabled) {
      setCount(text.length)
      return
    }
    setCount(0)
    const iv = window.setInterval(() => {
      setCount((c) => {
        // Stop the timer once the text is fully revealed — otherwise it keeps
        // waking the main thread (~55Hz) for the rest of the step.
        if (c + 1 >= text.length) window.clearInterval(iv)
        return c >= text.length ? c : c + 1
      })
    }, 18)
    return () => window.clearInterval(iv)
  }, [text, enabled])

  const safe = Math.min(count, text.length)
  return {
    typed: text.slice(0, safe),
    rest: text.slice(safe),
    done: safe >= text.length,
    complete: () => setCount(text.length),
  }
}

// One-shot celebratory burst on the finish step. Pure motion spans — no library.
function ConfettiBurst() {
  const prefersReducedMotion = useReducedMotion()
  if (prefersReducedMotion) return null
  const colors = ['#FF6B35', '#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#FFD166', '#8B5CF6']
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => {
        const angle = (i / 22) * Math.PI * 2 + (i % 2 ? 0.3 : 0)
        const dist = 78 + (i % 4) * 30
        return (
          <motion.span
            key={i}
            className={i % 3 === 0 ? 'absolute w-2 h-2 rounded-full' : 'absolute w-1.5 h-3 rounded-sm'}
            style={{ backgroundColor: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist * 0.7 + 60,
              opacity: 0,
              rotate: i % 2 === 0 ? 300 : -260,
              scale: 0.6,
            }}
            transition={{ duration: 1.6 + (i % 3) * 0.2, ease: 'easeOut', delay: 0.1 }}
          />
        )
      })}
    </div>
  )
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const prefersReducedMotion = useReducedMotion()
  const user = useStore((s) => s.user)
  const userId = useUserId()
  const bumpMemoriesRefresh = useStore((s) => s.bumpMemoriesRefresh)

  // Resume where the user left off if the app was killed mid-tour (not skipped —
  // skip/finish clear the marker). Clamped in case STEPS shrank across an update.
  const [stepIndex, setStepIndex] = useState(() => {
    try {
      const stored = parseInt(localStorage.getItem(RESUME_KEY) || '0', 10)
      return Number.isFinite(stored) ? Math.min(Math.max(0, stored), STEPS.length - 1) : 0
    } catch {
      return 0
    }
  })
  const [rect, setRect] = useState<SpotRect | null>(null)
  // True while the engine is navigating/locating the step's target element.
  const [searching, setSearching] = useState(true)
  // The tour owns its own fade-out and only then calls onComplete (an
  // AnimatePresence exit around this subtree wedges on the infinite child
  // animations, leaving an invisible full-screen overlay that blocks the app).
  const [closing, setClosing] = useState(false)
  // Measured card height → precise, non-overlapping placement.
  const [cardH, setCardH] = useState(CARD_EST_HEIGHT)
  // Viewport dims as STATE (not a per-render window read) so a height-only change
  // that leaves the card's measured height unchanged (setCardH bails) still
  // re-renders the geometry with a fresh vh — otherwise centering/cardScroll would
  // keep using a stale height and let the card overflow off the bottom.
  const [viewport, setViewport] = useState(() => ({
    vw: typeof window !== 'undefined' ? window.innerWidth : 375,
    vh: typeof window !== 'undefined' ? window.innerHeight : 800,
  }))
  // A short sparkle reward fired at the spotlight when an interactive hotspot
  // is tapped. Positioned via a ref so the (earlier-defined) tap handler can
  // read the current spotlight center.
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null)
  const burstIdRef = useRef(0)
  const spotCenterRef = useRef<{ x: number; y: number } | null>(null)
  // Seed-first-memory step state. `seeded` persists so a replay (or resume)
  // never creates a duplicate; `saving` guards the async create.
  const [saving, setSaving] = useState(false)
  // Pending post-save auto-advance timer — cancelled if the step changes first
  // (e.g. the user taps Continue) so it can't double-advance.
  const seedTimerRef = useRef<number | undefined>(undefined)
  const [seeded, setSeeded] = useState(() => {
    try {
      return localStorage.getItem(SEED_KEY) === 'true'
    } catch {
      return false
    }
  })
  // True only when the memory was created in THIS run — so a replay (seeded from
  // the persisted flag, memory already exists) shows an honest "you already have
  // memories" state instead of a misleading "just saved!" celebration.
  const [justSaved, setJustSaved] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  // The inner card body (the element that gets the max-height cap). We measure its
  // scrollHeight — the NATURAL, uncapped content height — for `cardH`, so applying
  // the cap never shrinks the measured value and feeds back into positioning. That
  // feedback loop (cap → smaller cardH → "it fits now" → uncap → regrow → re-cap)
  // was the root of repeated pin/cap oscillations; measuring scrollHeight ends it.
  const cardBodyRef = useRef<HTMLDivElement>(null)
  const primaryBtnRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  // Top safe-area inset feeding the card's minTop floor. Re-measured (below) after
  // mount and on rotation so it can't stay stale vs. a late capacitor.ts patch or an
  // orientation change.
  const [safeAreaTop, setSafeAreaTop] = useState(probeSafeAreaTop)
  const minTop = MIN_CARD_TOP + safeAreaTop
  // Last settled card top — the next step's card slides in FROM here so the
  // tour reads as one continuous guide gliding across the app.
  const prevTopRef = useRef<number>(typeof window !== 'undefined' ? window.innerHeight * 0.4 : 320)

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname

  // ─── Telemetry ─────────────────────────────────────────
  // One id per tour run so the funnel (start → per-step → seed → complete/skip)
  // can be stitched together. Refs keep the imperative track() calls off the
  // effect dependency graph.
  const tourRunIdRef = useRef<string | null>(null)
  if (tourRunIdRef.current === null) tourRunIdRef.current = generateUUID()
  const userIdRef = useRef(userId)
  userIdRef.current = userId
  const stepIndexRef = useRef(stepIndex)
  stepIndexRef.current = stepIndex
  const track = useCallback((name: string, extra?: Record<string, string | number | boolean>) => {
    const idx = stepIndexRef.current
    analyticsService.track(name, { run: tourRunIdRef.current || '', step: STEPS[idx]?.id ?? '', index: idx, ...extra }, userIdRef.current)
  }, [])

  // Fire tour_started once on mount (records the resumed-from step), then a
  // step_view the first time each step becomes visible.
  const viewedStepsRef = useRef<Set<number>>(new Set())
  const startedRef = useRef(false)
  useEffect(() => {
    // Ref-guarded so React 18 StrictMode's dev double-invoke fires it once.
    if (startedRef.current) return
    startedRef.current = true
    track('onboarding_started', { total: STEPS.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    // Track a SET of seen steps (not just the previous index): navigating Back
    // then forward returns to an already-counted step, and re-firing step_view
    // there would inflate the funnel's per-step view counts above unique viewers.
    if (searching || viewedStepsRef.current.has(stepIndex)) return
    viewedStepsRef.current.add(stepIndex)
    track('onboarding_step_view')
  }, [stepIndex, searching, track])

  // ─── Locate & track the step's target ──────────────────
  useEffect(() => {
    let cancelled = false
    let trackIv: number | undefined
    setRect(null)

    if (pathnameRef.current !== step.route) {
      // replace (not push) so the tour doesn't pollute browser history.
      navigate(step.route, { replace: true })
    }

    if (!step.target) {
      setSearching(false)
      return
    }
    setSearching(true)

    const started = Date.now()
    let resolved = false
    // Poll is invoked once synchronously (below) so an already-mounted target
    // resolves in the SAME commit — no ~120ms dark flash between steps — and
    // only falls back to the interval while the target is still mounting.
    const poll = () => {
      if (resolved || cancelled) return
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (el) {
        resolved = true
        window.clearInterval(findIv)
        const r = el.getBoundingClientRect()
        const fullyVisible = r.top >= 0 && r.bottom <= window.innerHeight
        if (!fullyVisible) {
          el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion ? 'auto' : 'smooth' })
        }
        // Match the spotlight's corner radius to the real element's.
        let radius = 16
        try {
          const parsed = parseFloat(getComputedStyle(el).borderRadius)
          if (Number.isFinite(parsed)) radius = clamp(parsed, 10, 28)
        } catch {
          /* keep default */
        }
        // Track continuously: smooth-scroll settling, keyboard, resize, layout
        // shifts all move the target — cheap at ~7 reads/sec for a short tour.
        const measure = () => {
          const b = el.getBoundingClientRect()
          setRect((prev) => {
            if (
              prev &&
              Math.abs(prev.top - b.top) < 1 &&
              Math.abs(prev.left - b.left) < 1 &&
              Math.abs(prev.width - b.width) < 1 &&
              Math.abs(prev.height - b.height) < 1
            ) {
              return prev
            }
            return { top: b.top, left: b.left, width: b.width, height: b.height, radius }
          })
        }
        measure()
        trackIv = window.setInterval(measure, TRACK_MS)
        setSearching(false)
      } else if (Date.now() - started > TARGET_FIND_TIMEOUT) {
        // Target never appeared (e.g. logged-out Aiya page) — centered fallback.
        resolved = true
        window.clearInterval(findIv)
        setSearching(false)
      }
    }
    const findIv = window.setInterval(poll, TARGET_POLL_MS)
    poll()

    return () => {
      cancelled = true
      window.clearInterval(findIv)
      if (trackIv) window.clearInterval(trackIv)
    }
    // Intentionally keyed on the step alone — pathname changes are a *result*
    // of this effect navigating and must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  // Measure the card synchronously (before paint) so placement never flashes.
  // Re-measure on resize/rotation too: a width change reflows the card taller,
  // and placement is computed against fresh vw/vh — a stale cardH would then let
  // the card overlap the spotlight or run off-screen.
  useLayoutEffect(() => {
    const measure = () => {
      if (searching) return
      // Natural content height (scrollHeight of the capped body) — cap-invariant, so
      // it can't feed back into the anchoring decision. Fall back to the wrapper's
      // offsetHeight before the body ref attaches.
      const h = cardBodyRef.current?.scrollHeight ?? cardRef.current?.offsetHeight
      if (h) setCardH(h)
    }
    // On a real viewport change, refresh vw/vh too (not just cardH): a height-only
    // change may leave the measured card height identical, so setCardH bails and,
    // without this, the geometry would keep a stale vh.
    const onViewportChange = () => {
      setViewport({ vw: window.innerWidth, vh: window.innerHeight })
      setSafeAreaTop(probeSafeAreaTop()) // rotation can change the top inset
      measure()
    }
    measure()
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('orientationchange', onViewportChange)
    // A ResizeObserver catches content-driven height changes that don't fire a
    // window resize — e.g. the Aiya-demo chat growing as its greeting arrives
    // and each tapped chip adds bubbles — so centering/cardScroll stay correct.
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined' && cardRef.current) {
      ro = new ResizeObserver(() => measure())
      ro.observe(cardRef.current)
    }
    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('orientationchange', onViewportChange)
      ro?.disconnect()
    }
    // `seeded`: the seed step's done-state swaps taller content in without a
    // stepIndex change; re-measure so centering stays correct.
  }, [stepIndex, searching, seeded])

  // Re-probe the safe-area inset just after mount: capacitor.ts patches
  // `--safe-area-inset-top` from an async init effect, which can land AFTER our
  // synchronous first read, leaving minTop under-inset for the whole tour otherwise.
  useEffect(() => {
    const id = window.setTimeout(() => setSafeAreaTop(probeSafeAreaTop()), 300)
    return () => window.clearTimeout(id)
  }, [])

  // A seed memory exists for this user if a memory carries the stored seed id
  // (STABLE — survives the user editing the memory's text) OR matches the canned seed
  // text in either language (the only signal when the memory was created before its
  // id could be persisted). Text alone is NOT enough: once the user edits the seed
  // memory's text it would stop matching, wrongly reading as "no seed."
  const seedExists = useCallback(
    (memories: Array<{ id: string; isCore?: boolean; text?: string }>) => {
      const seedId = readSeedId()
      const seedTexts = [t('tourSeedMemoryText', { lng: 'tr' }), t('tourSeedMemoryText', { lng: 'en' })]
      return memories.some(
        (m) => (seedId != null && m.id === seedId) || (m.isCore === true && seedTexts.includes(m.text ?? ''))
      )
    },
    [t]
  )

  // Reconcile the `seeded` flag against the DB on the seed step. SEED_KEY is a
  // device-global localStorage flag (not scoped by user id), so a DIFFERENT account
  // on the same device could inherit a stale "seed done" flag while having NO seed
  // memory of their own — which would hide the Save button and permanently block
  // them from creating their first memory via this flow. If the flag claims done but
  // this user has no seed memory, clear it so the create flow is available. Skipped
  // right after a fresh save (justSaved) to avoid racing the create's own commit.
  useEffect(() => {
    if (step.kind !== 'seed' || !seeded || justSaved) return
    let cancelled = false
    ;(async () => {
      try {
        const existing = await memoryService.getAll(userId)
        if (!cancelled && !seedExists(existing)) {
          setSeeded(false)
          try {
            localStorage.removeItem(SEED_KEY)
            localStorage.removeItem(SEED_ID_KEY)
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* getAll failed — keep the current state, don't risk a duplicate */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step.kind, seeded, justSaved, userId, seedExists])

  // ─── Flow control ──────────────────────────────────────
  const closingRef = useRef(false)
  const close = useCallback(
    (haptic: 'success' | 'light') => {
      if (closingRef.current) return
      closingRef.current = true
      clearResumeMarker()
      persistOnboardingComplete()
      // 'success' here is the finish-"later" button; 'light' is an X/Escape/back skip.
      track(haptic === 'success' ? 'onboarding_completed' : 'onboarding_skipped', haptic === 'success' ? { via: 'later' } : {})
      hapticFeedback(haptic)
      // replace (not push) so the tour never leaves its walked routes on the
      // browser history stack.
      if (pathnameRef.current !== '/') navigate('/', { replace: true })
      setClosing(true)
      // Let the fade-out play, then actually unmount via the store flag.
      window.setTimeout(onComplete, prefersReducedMotion ? 0 : 240)
    },
    [navigate, onComplete, prefersReducedMotion, track]
  )

  const finish = useCallback(() => close('success'), [close])

  // Activation-oriented ending: send the finishing user straight into adding
  // their first memory (the app's core action) instead of just dropping them on
  // an empty home. Fades the tour out the same way, then lands on /add-memory.
  const finishAndAdd = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    clearResumeMarker()
    persistOnboardingComplete()
    track('onboarding_completed', { via: 'add_memory' })
    hapticFeedback('success')
    navigate('/add-memory', { replace: true })
    setClosing(true)
    window.setTimeout(onComplete, prefersReducedMotion ? 0 : 240)
  }, [navigate, onComplete, prefersReducedMotion, track])

  // Dismissing the tour ('X' / Skip) closes it for now. It is NOT lost forever:
  // the tour can be replayed from Settings -> Replay tutorial (resetOnboarding).
  const skip = useCallback(() => close('light'), [close])

  const next = useCallback(() => {
    if (closingRef.current) return
    hapticFeedback('light')
    if (isLast) {
      finish()
    } else {
      // Clamp so a stale/double-fired next (e.g. ArrowRight autorepeat racing
      // the listener re-subscribe) can never index past the last step and
      // crash on STEPS[out-of-range].
      setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))
    }
  }, [isLast, finish])

  const back = useCallback(() => {
    if (closingRef.current) return
    hapticFeedback('light')
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  // Tapping the highlighted control itself: mirror its action, then advance.
  const handleHotspot = useCallback(() => {
    if (closingRef.current) return
    // Reward the tap with a quick sparkle at the spotlight before advancing.
    const c = spotCenterRef.current
    if (c && !prefersReducedMotion) {
      burstIdRef.current += 1
      setBurst({ id: burstIdRef.current, x: c.x, y: c.y })
      window.setTimeout(() => setBurst(null), 650)
    }
    if (step.navigateTo && pathnameRef.current !== step.navigateTo) navigate(step.navigateTo, { replace: true })
    next()
  }, [step.navigateTo, navigate, next, prefersReducedMotion])

  // Do-first: create the user's celebratory first memory in one tap, then
  // celebrate and advance. Guarded (SEED_KEY flag + a DB existence check) against
  // double-creating on replay / resume / app-kill.
  const saveFirstMemory = useCallback(async () => {
    if (saving || seeded || closingRef.current) return
    // Capture the seed step BEFORE the await so the telemetry event is attributed
    // to 'firstMemory' even if ArrowRight advances the step during the create.
    const seedStepIndex = stepIndexRef.current
    // Cross-tab guard: another tab may have set SEED_KEY after this component
    // mounted, leaving our in-memory `seeded` stale. Re-read the persisted flag
    // right before creating to avoid a duplicate seed in the common case. (This +
    // the DB dedup below don't fully close a TWO-TAB SIMULTANEOUS tap race, where
    // both tabs read the flag/DB before either writes — but the shipping app is a
    // single Capacitor webview, so concurrent tabs of the same account don't occur.)
    try {
      if (localStorage.getItem(SEED_KEY) === 'true') {
        setSeeded(true)
        return
      }
    } catch {
      /* ignore — fall through to create */
    }
    setSaving(true)
    try {
      // Durable dedup for the non-atomic (DB write, THEN SEED_KEY write) sequence
      // below: an app-kill between those two steps would leave the memory saved but
      // SEED_KEY unset, and the flag re-read above would then miss it and create a
      // SECOND seed on resume. `seedExists` matches the stored seed id (stable across
      // text edits) or the canned seed text in either language — never plain
      // isCore+gratitude (which would mis-adopt the user's own memory).
      const existing = await memoryService.getAll(userId)
      const priorSeed = existing.find((m) => seedExists([m]))
      if (priorSeed) {
        try {
          localStorage.setItem(SEED_KEY, 'true')
          localStorage.setItem(SEED_ID_KEY, priorSeed.id)
        } catch {
          /* ignore */
        }
        setSeeded(true)
        setSaving(false)
        return
      }
      const created = await memoryService.create({
        userId,
        text: t('tourSeedMemoryText'),
        category: 'gratitude',
        categories: ['gratitude'],
        intensity: 8,
        date: toLocalISODate(new Date()),
        connections: [],
        lifeArea: 'personal',
        isCore: true, // a milestone — the user's very first, core memory
        photos: [],
      })
      try {
        localStorage.setItem(SEED_KEY, 'true')
        // Persist the id so future existence checks survive the user editing its text.
        localStorage.setItem(SEED_ID_KEY, created.id)
      } catch {
        /* ignore */
      }
      // The memory is saved (and SEED_KEY set, so a replay won't duplicate it) —
      // these run regardless so the app reflects it: mark seeded, refresh lists,
      // log the truthful save.
      setSeeded(true)
      bumpMemoriesRefresh() // Home/Vault re-query so the new memory shows immediately
      track('onboarding_seed_saved', { step: STEPS[seedStepIndex]?.id ?? 'firstMemory', index: seedStepIndex })
      // If the user dismissed the tour while this create was in flight, stop here:
      // don't fire the celebration (confetti state, success haptic, auto-advance)
      // over the now-dismissed tour (mirrors the error path's closingRef guard).
      if (closingRef.current) {
        setSaving(false)
        return
      }
      setJustSaved(true)
      setSaving(false)
      hapticFeedback('success')
      // Let the celebration + "saved" message land, then move on. Both the
      // scheduling AND the callback are guarded to the seed step: if the user
      // advanced (e.g. ArrowRight) during the async create, the timer would
      // otherwise land on a later step and fire a phantom advance.
      if (stepIndexRef.current === seedStepIndex) {
        // Fixed dwell so the two-sentence "your first memory is saved" moment is
        // readable before auto-advance. NOT shortened under reduced motion:
        // reduced motion only drops the confetti, it doesn't speed up reading —
        // and these users often need MORE dwell time, not less. The always-present
        // Continue button lets anyone move on sooner.
        seedTimerRef.current = window.setTimeout(() => {
          if (stepIndexRef.current === seedStepIndex) next()
        }, 1900)
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Onboarding] seed memory failed:', err)
      setSaving(false)
      // Don't strand an error toast over the app if the user dismissed the tour
      // while this create was still in flight.
      if (!closingRef.current) toast.error(t('tourSeedError'))
    }
  }, [saving, seeded, userId, t, seedExists, bumpMemoriesRefresh, next, prefersReducedMotion, track])

  // Android back mirrors the skip control while the tour is open.
  useBackButton(() => {
    skip()
    return true
  }, true)
  useEscapeKey(skip, true)

  // Arrow keys drive the tour for keyboard users (Enter already works on the
  // focused primary button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (closingRef.current) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        // On the finish step, ArrowRight must match the focused primary CTA
        // (Enter → finishAndAdd) so keyboard users aren't silently routed past
        // the activation funnel that next()→finish() would skip.
        if (isLast) {
          finishAndAdd()
        } else if (step.kind === 'seed' && !seeded) {
          // A save in flight owns the step — ignore ArrowRight so a keyboard user
          // can't advance past a create that's about to succeed (which would log a
          // contradictory seed_skipped alongside the pending seed_saved, and bypass
          // the visibly-disabled Skip button).
          if (saving) return
          // Otherwise mirror the visible Skip button's telemetry.
          track('onboarding_seed_skipped')
          next()
        } else {
          next()
        }
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        e.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, back, stepIndex, isLast, finishAndAdd, step.kind, seeded, saving, track])

  // Move focus to each step's primary action for keyboard / screen-reader users
  // (preventScroll so it never fights the target's scroll-into-view).
  useEffect(() => {
    if (searching) return
    // Focus synchronously post-commit (preventScroll avoids fighting the
    // target's scroll-into-view). Not rAF-wrapped: rAF is throttled in a
    // background tab, which would drop the focus move entirely there.
    // `seeded` dep: on the seed step the focused Save button unmounts when it
    // flips to the done-state (Continue button) without a stepIndex change, so
    // re-run to re-focus and keep keyboard focus off <body>. `saving` dep:
    // re-assert focus onto the (kept-focusable) Save button when a save starts,
    // in case anything blurred it.
    primaryBtnRef.current?.focus({ preventScroll: true })
  }, [stepIndex, searching, seeded, saving])

  // Trap Tab focus inside the overlay. role=dialog + aria-modal promise an inert
  // background, but the tour deliberately keeps the real app rendered behind it
  // (it spotlights live controls), so without this a keyboard user could Tab to a
  // background nav button and navigate out from under the tour. Also catches the
  // brief searching-phase window where focus drops to <body>.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || closingRef.current) return
      const root = overlayRef.current
      if (!root) return
      const items = Array.from(
        root.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!root.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Mark the app content behind the tour inert + aria-hidden for as long as this
  // overlay is mounted (a modal). Managed here — not in Layout keyed on the flag —
  // so the lazy-load gap before the overlay renders never leaves the app inert
  // with no visible modal, and it's cleared exactly on unmount.
  useEffect(() => {
    const shell = document.querySelector('[data-app-shell]')
    if (!shell) return
    shell.setAttribute('inert', '')
    shell.setAttribute('aria-hidden', 'true')
    return () => {
      shell.removeAttribute('inert')
      shell.removeAttribute('aria-hidden')
    }
  }, [])

  // On close, move focus INTO the app content instead of letting it fall to <body>
  // (where a keyboard/SR user loses all context). The tour navigates away on close,
  // so the control that launched it is usually gone — the app shell is the stable
  // landing spot. Defined AFTER the inert effect so its cleanup runs later (React
  // runs cleanups in definition order): inert/aria-hidden are stripped first, so the
  // shell is focusable when we focus it.
  useEffect(() => {
    return () => {
      const shell = document.querySelector<HTMLElement>('[data-app-shell]')
      if (!shell) return
      try {
        if (!shell.hasAttribute('tabindex')) shell.setAttribute('tabindex', '-1')
        shell.focus({ preventScroll: true })
      } catch {
        /* ignore — nothing to restore focus to */
      }
    }
  }, [])

  // ─── Card copy ─────────────────────────────────────────
  const firstName = user?.displayName ? user.displayName.trim().split(/\s+/)[0] : ''
  // Time-of-day greeting for a warm first impression (reuses the app's greeting
  // strings, so it's localized in both languages).
  const greetingWord = (() => {
    const h = new Date().getHours()
    if (h < 6) return t('greetingNight')
    if (h < 12) return t('greetingMorning')
    if (h < 18) return t('greetingAfternoon')
    if (h < 22) return t('greetingEvening')
    return t('greetingNight')
  })()
  const isSeed = step.kind === 'seed'
  const isAiyaDemo = step.kind === 'aiyaDemo'
  const title =
    isSeed && seeded
      ? justSaved
        ? t('tourSeedDoneTitle')
        : t('tourSeedAlreadyTitle') // replay: memory already existed
      : step.id === 'welcome'
        ? t(step.titleKey, { name: firstName ? ` ${firstName}` : '', greeting: greetingWord })
        : t(step.titleKey)
  const text =
    isSeed && seeded
      ? justSaved
        ? t('tourSeedDoneText')
        : t('tourSeedAlreadyText')
      : step.id === 'finish' && seeded
        ? t('tourFinishTextDone')
        : t(step.textKey)
  // Not on the aiyaDemo step: that branch renders <AiyaDemo/>, never typing.typed,
  // so an enabled typewriter there would just spin a dead interval.
  const typing = useTypewriter(text, !searching && !prefersReducedMotion && !isAiyaDemo)

  // ─── Geometry ──────────────────────────────────────────
  const { vw, vh } = viewport

  const spot = rect
    ? {
        top: rect.top - SPOT_PADDING,
        left: rect.left - SPOT_PADDING,
        width: rect.width + SPOT_PADDING * 2,
        height: rect.height + SPOT_PADDING * 2,
        radius: rect.radius + SPOT_PADDING,
      }
    : null

  const isWelcome = step.id === 'welcome'
  const isFinish = step.id === 'finish'

  // Choose the side with room; clamp into the viewport so the card can never
  // run off-screen or cover the Skip control. `tailDir` points the speech
  // bubble back at the spotlight. If the target is so tall that neither side
  // fits, anchoring would force the card OVER the highlighted element — so we
  // fall back to a centered card (the spotlight ring still highlights it).
  let cardTop = 0
  let tailDir: 'up' | 'down' = 'up'
  let tooTall = false
  // True when an above-anchored card is forced UP to minTop because it can't fit at
  // its natural position — the one case whose bottom can cross into the spotlight, so
  // it needs the spot-relative height cap below. A card at its natural above position
  // already sits with its bottom at spot.top - CARD_MARGIN and must NOT get that cap
  // (there, cardMaxHeight would equal cardH exactly — a self-referential cap that
  // stops the measured height from ever growing past a stale estimate).
  let pinnedAbove = false
  if (spot) {
    const spotBottom = spot.top + spot.height
    const spaceBelow = vh - spotBottom
    const spaceAbove = spot.top
    const needed = cardH + CARD_MARGIN * 2
    if (spaceBelow >= needed) {
      cardTop = spotBottom + CARD_MARGIN
      tailDir = 'up'
    } else if (spaceAbove >= needed) {
      cardTop = spot.top - cardH - CARD_MARGIN
      tailDir = 'down'
    } else {
      tooTall = true
    }
    // Never CENTER a too-tall card over an interactive step's hotspot (that would
    // cover the very control the copy tells the user to tap). Pin it above the spot
    // and let it scroll — but ONLY if there's usable room above (>= ~100px). Below
    // that the pinned card would be squeezed to nothing, so keep the centered
    // fallback (it covers the tiny bottom-nav but stays usable via its Next button).
    if (tooTall && step.interactive && spot.top - CARD_MARGIN - minTop >= 100) {
      tooTall = false
      cardTop = minTop
      tailDir = 'down'
      pinnedAbove = true
    }
    // Non-inverting clamp: pin the top at minTop (MIN_CARD_TOP + safe-area) for a
    // card taller than the viewport (a plain clamp with max < min would return a
    // negative top and clip off-screen). If this RAISES an above-anchored card up to
    // minTop, it couldn't fit naturally → it's pinned, so flag it for the cap.
    if (!tooTall) {
      const clamped = Math.max(minTop, Math.min(cardTop, vh - cardH - CARD_MARGIN))
      if (tailDir === 'down' && clamped > cardTop) pinnedAbove = true
      cardTop = clamped
    }
  }

  // `isCentered` = centered POSITION (welcome/finish/no-target + the too-tall
  // fallback). `bigCard` = the tall hero LAYOUT (Aiya 120, column) — used ONLY
  // for genuine no-target steps, NOT the too-tall fallback, so the fallback card
  // stays compact and `tooTall` (which is measured from cardH) can't feed back
  // on itself and force a needless overlap.
  const isCentered = !searching && (!spot || tooTall)
  const bigCard = !searching && !spot

  // Speech-bubble tail x-position (relative to the centered card).
  const cardWidth = Math.min(384, vw - 32)
  const cardLeft = (vw - cardWidth) / 2
  const spotCenterX = spot ? spot.left + spot.width / 2 : vw / 2
  const tailX = clamp(spotCenterX - cardLeft, 26, cardWidth - 26)
  // (tail visibility — `tailReaches`/`showTail` — is computed after the height cap
  // below, because it must measure against the card's RENDERED, capped height.)

  // Keep the current spotlight center in a ref so the hotspot tap handler
  // (defined earlier) can position its reward sparkle.
  spotCenterRef.current = spot ? { x: spot.left + spot.width / 2, y: spot.top + spot.height / 2 } : null

  // Aiya glances toward the element she's introducing (up/down from the tail
  // direction, left/right from the spotlight's horizontal offset). Forward gaze
  // on the centered welcome/finish steps.
  const aiyaLook =
    spot && !isCentered
      ? { x: clamp((spotCenterX - vw / 2) / (vw / 2), -1, 1) * 0.85, y: tailDir === 'up' ? -0.9 : 0.9 }
      : { x: 0, y: 0 }

  // Unified vertical position: centered steps get a real top too, so ALL cards
  // are `top`-positioned and can glide between steps from the previous position.
  // Non-inverting (Math.max outer) so a card taller than the viewport pins at
  // minTop (MIN_CARD_TOP + safe-area) instead of clamping to a negative top and
  // clipping off-screen. The Aiya-demo card GROWS as its chat fills in; centering
  // it off the live cardH would make the whole card drift upward on every message.
  // Center it off a stable estimate instead so the frame stays put and only the
  // inner chat scrolls (cardScroll still catches an over-tall card on short screens).
  const centeredTop = isAiyaDemo
    ? Math.max(minTop, (vh - Math.min(vh * 0.62, 520)) / 2)
    : Math.max(minTop, Math.min((vh - cardH) / 2, vh - cardH - CARD_MARGIN))
  const cardPosTop = isCentered ? centeredTop : cardTop
  // A card PINNED above its spotlight (raised to minTop because it couldn't fit
  // naturally) must not grow DOWN into the spotlight and cover the highlighted
  // control. Bound it by the spot's top instead of the viewport bottom. Because a
  // pinned card's top is minTop — INDEPENDENT of the measured cardH — this cap is a
  // real geometric bound (spot.top - CARD_MARGIN - minTop), not the self-referential
  // `== cardH` cap that a naturally-anchored above card would get. Non-pinned cards
  // (natural-above, below, centered) bound by the viewport bottom as usual.
  const cardBottomLimit = pinnedAbove ? spot!.top - CARD_MARGIN : vh - CARD_MARGIN
  // If the card can't fully fit between its ACTUAL top and that bottom limit, let it
  // scroll internally so the buttons stay reachable. Keyed to cardPosTop (not minTop):
  // the aiyaDemo card sits at a fixed estimate top > minTop, so a guard keyed to the
  // bare minimum would under-fire and clip its Back/Next row on mid-height viewports.
  // `>=` (not `>`) is load-bearing: once we cap the card to `cardMaxHeight`, its
  // measured height makes `cardPosTop + cardH` land EXACTLY on the limit. A strict `>`
  // would then flip cardScroll false, drop the cap, let the card grow back, and
  // re-trigger the cap — an infinite ResizeObserver cap/un-cap jitter. `>=` keeps it
  // capped (a no-op re-measure), so the height settles.
  const cardScroll = cardPosTop + cardH >= cardBottomLimit
  // The scroll box must fit between the card's real top and that bottom limit.
  // Guard against negative on a degenerate viewport so we never emit a negative
  // max-height (the pin threshold above keeps a pinned card's room at >= ~100px).
  const cardMaxHeight = Math.max(0, cardBottomLimit - cardPosTop)
  // Cap a pinned above-card UNCONDITIONALLY (its cardH-independent bound guards
  // against a briefly-stale cardH covering the control); otherwise cap only when the
  // content actually overflows its bottom limit.
  const capCard = cardScroll || pinnedAbove

  // Hide the tail if it can't actually reach the spotlight (card clamped far away).
  // Measured against the RENDERED height: cardH is the natural/uncapped scrollHeight,
  // but a capped card's true bottom edge is cardPosTop + min(cardH, cardMaxHeight),
  // so using cardH directly would wrongly hide the tail of a pinned+capped card that
  // actually sits right next to the spotlight.
  const renderedCardH = capCard ? Math.min(cardH, cardMaxHeight) : cardH
  const spotCenterY = spot ? spot.top + spot.height / 2 : 0
  const tailReaches =
    spot &&
    (tailDir === 'up'
      ? Math.abs(cardPosTop - (spot.top + spot.height)) < 40
      : Math.abs(spot.top - (cardPosTop + renderedCardH)) < 40)
  const showTail = Boolean(spot && !isCentered && tailReaches && cardPosTop > spotCenterY === (tailDir === 'up'))

  // Remember where the card settled so the NEXT step slides in from here.
  useEffect(() => {
    if (!searching) prevTopRef.current = cardPosTop
  })

  // Persist the current step so an app-kill mid-tour resumes here next launch.
  // Also cancel any pending seed auto-advance when the step changes (manual
  // Continue tap) so the timer can't fire an extra advance on the next step.
  useEffect(() => {
    try {
      localStorage.setItem(RESUME_KEY, String(stepIndex))
    } catch {
      /* localStorage unavailable — resume simply won't work, no crash */
    }
    return () => {
      if (seedTimerRef.current) {
        window.clearTimeout(seedTimerRef.current)
        seedTimerRef.current = undefined
      }
    }
  }, [stepIndex])

  // Clear the "just saved!" flag once we leave the seed step. `justSaved` gates the
  // one-shot celebration (confetti + check badge + "saved" note); without this reset
  // it stays true for the session, so navigating Back to the seed step would replay
  // the whole celebration for a save that didn't just happen. Cleared → a return
  // visit shows the honest "your memory is safe" (tourSeedAlready) state instead.
  useEffect(() => {
    if (step.kind !== 'seed' && justSaved) setJustSaved(false)
  }, [step.kind, justSaved])

  const spring = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 300, damping: 30 }

  const cardEnter = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 320, damping: 28 }

  const primaryLabel = isWelcome ? t('tourStart') : isLast ? t('getStarted') : t('nextStep')

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => {
        if (!typing.done) typing.complete()
      }}
    >
      {/* Screen-reader announcement of the step (the visible copy types out and
          is aria-hidden, which would otherwise spam per-character). */}
      <span className="sr-only" aria-live="polite">
        {searching
          ? ''
          : `${t('tourProgress', {
              current: stepIndex + 1,
              total: STEPS.length,
              defaultValue: `Adım ${stepIndex + 1} / ${STEPS.length}`,
            })}. ${title}. ${text}`}
      </span>

      {/* While locating a still-mounting target (e.g. Aiya's Start button behind
          its loading spinner) show a friendly centered Aiya over the dim instead
          of a bare black screen. Already-present targets resolve in the same
          commit, so this only appears on genuinely slow steps. */}
      {searching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.25, delay: prefersReducedMotion ? 0 : 0.15 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <AiyaCharacter size={72} mood="think" />
        </motion.div>
      )}

      {/* Backdrop: spotlight cutout (box-shadow trick) or plain dark overlay */}
      {spot ? (
        <motion.div
          className="absolute pointer-events-none"
          initial={false}
          animate={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height, borderRadius: spot.radius }}
          transition={spring}
          style={{
            boxShadow:
              '0 0 0 3px rgba(255,107,53,0.9), 0 0 26px 6px rgba(255,107,53,0.35), 0 0 0 9999px rgba(2,6,23,0.74)',
          }}
        >
          {/* Pulsing attention ring */}
          {!prefersReducedMotion && (
            <motion.div
              className="absolute -inset-1.5 rounded-[inherit] border-2 border-primary/60"
              style={{ borderRadius: spot.radius + 6 }}
              animate={{ scale: [1, 1.05, 1], opacity: [0.9, 0.3, 0.9] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {/* One-shot "camera focus" ring — pings once each step as the
              spotlight lands on its new target. */}
          {!prefersReducedMotion && (
            <motion.div
              key={step.id}
              className="absolute rounded-[inherit] border-2 border-white/70"
              style={{ inset: -2, borderRadius: spot.radius + 8 }}
              initial={{ opacity: 0.55, scale: 1.55 }}
              animate={{ opacity: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          )}
        </motion.div>
      ) : (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
      )}

      {/* Tappable hotspot over interactive targets — advances by "using" the
          real control. Ripple invites the tap. */}
      {spot && step.interactive && !searching && (
        <div
          className="absolute cursor-pointer touch-manipulation"
          role="button"
          tabIndex={-1}
          aria-label={title}
          onClick={(e) => {
            e.stopPropagation()
            handleHotspot()
          }}
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height, borderRadius: spot.radius }}
        >
          {!prefersReducedMotion &&
            [0, 1].map((i) => (
              <motion.span
                key={i}
                className="absolute inset-0 border-2 border-primary"
                style={{ borderRadius: spot.radius }}
                initial={{ opacity: 0.7, scale: 1 }}
                animate={{ opacity: 0, scale: 1.35 }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
              />
            ))}
        </div>
      )}

      {/* Reward sparkle at the tapped hotspot (a small "nice, you did it"). */}
      {burst && !prefersReducedMotion && (
        <div
          key={burst.id}
          className="pointer-events-none absolute z-20"
          style={{ left: burst.x, top: burst.y }}
          aria-hidden="true"
        >
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return (
              <motion.span
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-primary"
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(a) * 26, y: Math.sin(a) * 26, opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            )
          })}
        </div>
      )}

      {/* Skip — always reachable at the top right */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          skip()
        }}
        aria-label={t('skip')}
        // The overlay is `fixed inset-0`, so it bypasses the body's safe-area
        // padding — inset BOTH top and right so this (the only dismiss control on
        // the nav-vault/aiya steps) clears the notch/rounded corner in landscape too.
        className="absolute z-10 flex items-center gap-1 px-3 py-2 rounded-full bg-black/45 text-white/90 text-sm font-medium touch-manipulation backdrop-blur-sm"
        style={{
          top: 'calc(var(--safe-area-inset-top, 0px) + 12px)',
          right: 'calc(var(--safe-area-inset-right, 0px) + 12px)',
        }}
      >
        <X size={15} />
        {t('skip')}
      </button>

      {/* Step card. Keyed remount per step + a slide FROM the previous card's
          position (prevTopRef) makes the tour read as one guide gliding across
          the app rather than cards popping in and out. (No AnimatePresence exit:
          waiting on exits while the engine navigates/searches can wedge the swap.) */}
      {!searching && (
        <motion.div
          key={step.id}
          initial={{ top: prevTopRef.current, opacity: 0, scale: 0.97 }}
          animate={{ top: cardPosTop, opacity: 1, scale: 1 }}
          transition={cardEnter}
          className="absolute left-0 right-0 flex justify-center px-4"
        >
          <div ref={cardRef} className="relative w-full max-w-sm">
            {/* Speech-bubble tail (behind the card body) */}
            {showTail && (
              <div
                aria-hidden="true"
                className="absolute w-3.5 h-3.5 rotate-45 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                style={{
                  left: tailX - TAIL,
                  ...(tailDir === 'up' ? { top: -6 } : { bottom: -6 }),
                }}
              />
            )}

            {/* Celebration burst — rendered OUTSIDE the card body (a sibling in the
                overflow-visible wrapper, z-20 above the card) so its particles are
                never clipped by the body's overflow-y-auto cap on short viewports. */}
            {(isFinish || (isSeed && justSaved)) && <ConfettiBurst />}

            <div
              ref={cardBodyRef}
              className={`relative z-10 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full p-5 pt-6 ${
                capCard ? 'overflow-y-auto overscroll-contain' : ''
              }`}
              // Cap the height to fit between the card's real top and the bottom
              // margin (or the spotlight top, for an above-anchored card) so the
              // Back/Next row stays reachable and the card never covers the target.
              style={capCard ? { maxHeight: cardMaxHeight } : undefined}
              onClick={(e) => {
                e.stopPropagation()
                if (!typing.done) typing.complete()
              }}
            >
              {isAiyaDemo ? (
                /* No-login taste of chatting with Aiya (reacts to the seed memory). */
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2.5 text-center leading-snug">
                    {title}
                  </h2>
                  <AiyaDemo
                    seeded={seeded}
                    firstName={firstName}
                    onEngage={(chip) => track('onboarding_aiya_demo', { chip })}
                  />
                </div>
              ) : (
                /* Aiya + speech */
                <div className={bigCard ? 'flex flex-col items-center text-center' : 'flex items-start gap-3.5'}>
                  <motion.div
                    className="flex-shrink-0"
                    initial={prefersReducedMotion ? false : { scale: 0.7, y: 4, rotate: -6 }}
                    animate={{ scale: 1, y: 0, rotate: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 13, delay: 0.04 }}
                  >
                    <AiyaCharacter size={bigCard ? 120 : 64} mood={isSeed && seeded ? 'excited' : step.mood} look={aiyaLook} />
                  </motion.div>
                  <div className={bigCard ? 'mt-4 w-full' : 'flex-1 min-w-0'}>
                    {!bigCard && (
                      <div className="text-[11px] font-bold text-orange-700 dark:text-primary uppercase tracking-wider mb-0.5">
                        Aiya
                      </div>
                    )}
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1.5 leading-snug">
                      {title}
                    </h2>
                    {/* Visible copy types out; the untyped remainder stays laid out
                        (transparent) so the card height is stable. aria-hidden — the
                        sr-only live region above carries the announcement. */}
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed" aria-hidden="true">
                      {typing.typed}
                      {!typing.done && <span className="text-primary animate-pulse">▍</span>}
                      <span className="text-transparent">{typing.rest}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Seed step: a preview of the ready-made first memory the user can
                  save in one tap. A check badge lands on it once saved. */}
              {isSeed && (
                <div className="mt-4">
                  <div className="relative rounded-2xl border border-primary/25 bg-primary/5 dark:bg-primary/10 p-4 text-left">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles size={13} className="text-orange-700 dark:text-primary" />
                      <span className="text-[11px] font-bold text-orange-700 dark:text-primary uppercase tracking-wider">
                        {t('tourSeedMemoryLabel')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                      {t('tourSeedMemoryText')}
                    </p>
                    {justSaved && (
                      <motion.div
                        initial={prefersReducedMotion ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 15 }}
                        className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-success flex items-center justify-center shadow-md"
                      >
                        <Check size={16} className="text-white" strokeWidth={3} />
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* Progress dots */}
              <div
                className="flex gap-1.5 justify-center my-4"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={STEPS.length}
                aria-valuenow={stepIndex + 1}
                aria-label={t('tourProgress', { current: stepIndex + 1, total: STEPS.length, defaultValue: `Adım ${stepIndex + 1} / ${STEPS.length}` })}
              >
                {STEPS.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === stepIndex
                        ? 'bg-primary w-6 shadow-[0_0_8px_rgba(255,107,53,0.55)]'
                        : idx < stepIndex
                          ? 'bg-primary/40 w-1.5'
                          : 'bg-gray-300 dark:bg-gray-600 w-1.5'
                    }`}
                  />
                ))}
              </div>

              {/* Actions */}
              {isWelcome ? (
                <div className="flex gap-3">
                  <button
                    onClick={skip}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                  >
                    {t('skip')}
                  </button>
                  <button
                    ref={primaryBtnRef}
                    onClick={next}
                    className="flex-1 px-4 py-3 gradient-primary text-white rounded-xl font-semibold shadow-md hover:shadow-xl transition-all touch-manipulation"
                  >
                    {primaryLabel}
                  </button>
                </div>
              ) : isSeed ? (
                seeded ? (
                  // Saved. A fresh save auto-advances after the celebration, but
                  // always render a Continue button too so a replay/resume user
                  // (seed flag already set → no timer) is never stuck.
                  <div className="flex flex-col gap-2.5">
                    {justSaved && (
                      <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-success font-semibold text-sm">
                        <Check size={17} strokeWidth={3} />
                        {t('tourSeedSavedNote')}
                      </div>
                    )}
                    <button
                      ref={primaryBtnRef}
                      onClick={next}
                      className="w-full px-4 py-3 gradient-primary text-white rounded-xl font-semibold shadow-md hover:shadow-xl transition-all touch-manipulation"
                    >
                      {t('nextStep')}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <button
                      ref={primaryBtnRef}
                      onClick={saveFirstMemory}
                      // NOT `disabled` while saving: a disabled button blurs, dropping
                      // keyboard/SR focus to <body> for the whole async create. The
                      // click handler already no-ops re-entry (saving/seeded guard),
                      // so we keep it focusable and signal busy via aria-busy + style.
                      aria-busy={saving}
                      className={`w-full px-4 py-3 gradient-primary text-white rounded-xl font-semibold shadow-md hover:shadow-xl transition-all touch-manipulation flex items-center justify-center gap-2 ${saving ? 'opacity-75' : ''}`}
                    >
                      <motion.span
                        animate={saving && !prefersReducedMotion ? { rotate: 360 } : { rotate: 0 }}
                        transition={saving && !prefersReducedMotion ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
                        className="inline-flex"
                      >
                        <Sparkles size={18} />
                      </motion.span>
                      {saving ? t('tourSeedSaving') : t('tourSeedSaveCta')}
                    </button>
                    <button
                      onClick={() => {
                        track('onboarding_seed_skipped')
                        next()
                      }}
                      disabled={saving}
                      className="w-full px-4 py-2.5 rounded-xl font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation disabled:opacity-50"
                    >
                      {t('tourSeedSkip')}
                    </button>
                  </div>
                )
              ) : isFinish ? (
                // Activation ending: primary funnels into adding a memory (their
                // first, or another if the seed step already created one).
                <div className="flex flex-col gap-2.5">
                  <button
                    ref={primaryBtnRef}
                    onClick={finishAndAdd}
                    className="w-full px-4 py-3 gradient-primary text-white rounded-xl font-semibold shadow-md hover:shadow-xl transition-all touch-manipulation"
                  >
                    {seeded ? t('tourFinishCtaMore') : t('tourFinishCta')}
                  </button>
                  <button
                    onClick={finish}
                    className="w-full px-4 py-2.5 rounded-xl font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                  >
                    {t('tourFinishLater')}
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  {stepIndex > 0 && (
                    <button
                      onClick={back}
                      aria-label={t('back')}
                      className="px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                    >
                      {t('back')}
                    </button>
                  )}
                  <button
                    ref={primaryBtnRef}
                    onClick={next}
                    className="flex-1 px-4 py-3 gradient-primary text-white rounded-xl font-semibold shadow-md hover:shadow-xl transition-all touch-manipulation"
                  >
                    {primaryLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
