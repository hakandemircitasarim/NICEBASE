import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'
import AiyaCharacter from './AiyaCharacter'
import { hapticFeedback } from '../utils/haptic'

type DemoMsg = { id: number; role: 'aiya' | 'user'; text: string }

interface AiyaDemoProps {
  /** Whether the user saved the seed memory — lets Aiya open with a personal
   *  reaction to it instead of a generic hello. */
  seeded: boolean
  /** First name (or '') for warm interpolation. */
  firstName: string
  /** Fired the first time the user taps a suggested prompt (engagement signal). */
  onEngage?: (chip: string) => void
}

// A no-login "taste" of Aiya: she proactively reacts to the memory the user just
// created, and they can tap suggested prompts to feel the conversation — all
// scripted (no API, no auth, instant). The goal is to make Aiya feel worth
// signing in for, rather than gating her behind a login wall.
export default function AiyaDemo({ seeded, firstName, onEngage }: AiyaDemoProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const name = firstName ? `, ${firstName}` : ''

  const [messages, setMessages] = useState<DemoMsg[]>([])
  const [typing, setTyping] = useState(true)
  const [asked, setAsked] = useState<Record<string, boolean>>({})
  const idRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<number[]>([])

  const nextId = () => ++idRef.current

  // Open with Aiya's greeting (personal if a memory was seeded).
  useEffect(() => {
    const opening = seeded ? t('aiyaDemoOpeningSeeded', { name }) : t('aiyaDemoOpeningPlain', { name })
    const delay = prefersReducedMotion ? 0 : 900
    const timer = window.setTimeout(() => {
      setTyping(false)
      setMessages([{ id: nextId(), role: 'aiya', text: opening }])
    }, delay)
    timersRef.current.push(timer)
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t))
      timersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }, [messages, typing, prefersReducedMotion])

  const allChips = [
    { key: 'who', label: t('aiyaDemoChipWho'), reply: t('aiyaDemoReplyWho', { name }) },
    { key: 'cheer', label: t('aiyaDemoChipCheer'), reply: t('aiyaDemoReplyCheer', { name }) },
  ]
  const chips = allChips.filter((c) => !asked[c.key])

  const ask = useCallback(
    (chip: { key: string; label: string; reply: string }) => {
      if (typing || asked[chip.key]) return
      hapticFeedback('light')
      onEngage?.(chip.key)
      setAsked((a) => ({ ...a, [chip.key]: true }))
      setMessages((m) => [...m, { id: nextId(), role: 'user', text: chip.label }])
      setTyping(true)
      // The tapped chip unmounts (filtered out of `chips`); move focus into the
      // live chat log so keyboard/SR focus doesn't drop to <body> and the reply
      // is announced.
      scrollRef.current?.focus({ preventScroll: true })
      const timer = window.setTimeout(() => {
        setTyping(false)
        setMessages((m) => [...m, { id: nextId(), role: 'aiya', text: chip.reply }])
      }, prefersReducedMotion ? 0 : 1100)
      timersRef.current.push(timer)
    },
    [typing, asked, onEngage, prefersReducedMotion]
  )

  return (
    <div className="mt-1">
      {/* Chat area — capped + internally scrollable so the card never balloons.
          role=log + aria-live announces each appended bubble to screen readers;
          tabIndex=-1 lets `ask` move focus here so it never drops to <body>. */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={t('aiyaDemoTitle')}
        tabIndex={-1}
        className="max-h-[42vh] overflow-y-auto overscroll-contain rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 p-3 space-y-2.5 outline-none"
      >
        {messages.map((m) =>
          m.role === 'aiya' ? (
            <motion.div
              key={m.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-end gap-2"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <AiyaCharacter size={22} animated={false} className="translate-y-[6%]" />
              </div>
              <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 text-[13px] leading-relaxed text-gray-800 dark:text-gray-100 shadow-sm">
                {m.text}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={m.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end"
            >
              <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-orange-500 text-white text-[13px] leading-relaxed shadow-sm">
                {m.text}
              </div>
            </motion.div>
          )
        )}

        {typing && (
          <div className="flex items-end gap-2" role="status">
            <span className="sr-only">{t('aiyaDemoTyping')}</span>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <AiyaCharacter size={22} animated={false} className="translate-y-[6%]" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 flex items-center gap-1.5 shadow-sm">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
                  animate={prefersReducedMotion ? undefined : { y: [0, -5, 0] }}
                  transition={prefersReducedMotion ? undefined : { duration: 0.6, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggested prompts — tapping one feels like a real reply. */}
      {chips.length > 0 && !typing && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {chips.map((c) => (
            <motion.button
              key={c.key}
              whileTap={{ scale: 0.96 }}
              onClick={() => ask(c)}
              className="px-3.5 py-2 rounded-full border border-primary/25 bg-primary/5 dark:bg-primary/10 text-primary text-[13px] font-medium hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors touch-manipulation"
            >
              {c.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* Warm, no-pressure close — implies the ongoing relationship without a
          hard "sign in to chat" wall. */}
      <p className="text-[12px] text-gray-500 dark:text-gray-400 text-center mt-3 px-2 leading-relaxed">
        {t('aiyaDemoFooter')}
      </p>
    </div>
  )
}
