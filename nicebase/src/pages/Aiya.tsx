import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate } from 'react-router-dom'
import { Memory } from '../types'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, ChevronLeft, Plus, Trash2, ChevronDown,
  MessageCircle, MoreVertical, X,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmationDialog from '../components/ConfirmationDialog'
import { aiyaService } from '../services/aiyaService'
import { hapticFeedback } from '../utils/haptic'
import { generateUUID } from '../utils/uuid'
import { useDebounce } from '../hooks/useDebounce'

// ─── Types ───────────────────────────────────────────────

type AiyaMessage = {
  role: 'user' | 'assistant'
  content: string
  ts?: number
}

type AiyaChat = {
  id: string
  title: string
  messages: AiyaMessage[]
  createdAt: number
  updatedAt: number
}

type AiyaProfileMeta = {
  summary: string
  updatedAt: number
  messageCount: number
}

type ViewMode = 'list' | 'chat'

// ─── Constants ───────────────────────────────────────────

const HISTORY_LIMIT = 40
const PROFILE_MIN_MESSAGE_COUNT = 4
const PROFILE_UPDATE_MESSAGE_INTERVAL = 6
const PROFILE_UPDATE_COOLDOWN_MS = 6 * 60 * 60 * 1000
const DRAFT_SAVE_KEY_PREFIX = 'aiya_draft_'

// ─── Helpers ─────────────────────────────────────────────

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed as T
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Failed to load JSON from localStorage key "${key}":`, error)
    }
    return null
  }
}

function saveJson(key: string, value: unknown) {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false
    }
    const serialized = JSON.stringify(value)
    localStorage.setItem(key, serialized)
    return true
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Failed to save to localStorage key "${key}":`, error)
    }
    return false
  }
}

function trimMessages(msgs: AiyaMessage[]) {
  return msgs.slice(-HISTORY_LIMIT)
}

function generateTitle(msg: string, t: TFunction): string {
  const cleaned = msg.trim().replace(/\n/g, ' ')
  if (cleaned.length >= 10) return cleaned.slice(0, 40) + (cleaned.length > 40 ? '…' : '')
  return t('aiyaNewChat', { defaultValue: 'Yeni Sohbet' }) + ' — ' + new Date().toLocaleDateString()
}

function formatTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: number, locale: string): string {
  const now = Date.now()
  const diff = now - ts
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    return new Date(ts).toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  } else if (days === 1) {
    return locale === 'tr' ? 'Dün' : 'Yesterday'
  } else if (days < 7) {
    return new Date(ts).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short' })
  } else {
    return new Date(ts).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { 
      day: 'numeric', 
      month: 'short' 
    })
  }
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
}

// ─── Aiya Avatar Component ──────────────────────────────

function AiyaAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center flex-shrink-0 shadow-sm"
      style={{ width: size, height: size }}
    >
      <Sparkles size={size * 0.5} className="text-white" strokeWidth={2.5} />
    </div>
  )
}

// ─── Typing Indicator ────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-end gap-2.5 mb-4">
      <AiyaAvatar size={32} />
      <div className="bg-gray-100 dark:bg-gray-700 rounded-3xl rounded-bl-md px-5 py-3.5 flex items-center gap-1.5 shadow-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Suggestion Chips ────────────────────────────────────

function SuggestionChips({ 
  onSelect, 
  memories 
}: { 
  onSelect: (text: string) => void
  memories: Memory[]
}) {
  const { t } = useTranslation()
  
  const chips = useMemo(() => {
    const baseChips = [
      { key: 'analyze', label: t('aiyaChipAnalyze', { defaultValue: 'Anılarımı analiz et' }) },
      { key: 'mood', label: t('aiyaChipMood', { defaultValue: 'Bugün nasılım?' }) },
      { key: 'motivate', label: t('aiyaChipMotivate', { defaultValue: 'Beni motive et' }) },
      { key: 'week', label: t('aiyaChipWeek', { defaultValue: 'Son haftamı özetle' }) },
    ]
    
    if (memories.length === 0) return baseChips
    
    const recentMemories = memories.slice(0, 10)
    const categories = new Set(recentMemories.map(m => m.category))
    const connections = new Set(recentMemories.flatMap(m => m.connections))
    
    const personalized: Array<{ key: string; label: string }> = []
    
    if (categories.has('gratitude')) {
      personalized.push({ 
        key: 'gratitude', 
        label: t('aiyaChipGratitude', { defaultValue: 'Minettarlık anılarımı göster' }) 
      })
    }
    if (categories.has('love')) {
      personalized.push({ 
        key: 'love', 
        label: t('aiyaChipLove', { defaultValue: 'Sevgi anılarımı hatırlat' }) 
      })
    }
    
    if (connections.size > 0) {
      const topConnection = Array.from(connections)[0]
      personalized.push({ 
        key: 'connection', 
        label: t('aiyaChipConnection', { defaultValue: `${topConnection} ile anılarım` }) 
      })
    }
    
    return [...baseChips, ...personalized].slice(0, 6)
  }, [memories, t])

  return (
    <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1.5 -mx-1 px-1 snap-x snap-mandatory">
      {chips.map((c) => (
        <motion.button
          key={c.key}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            hapticFeedback('light')
            onSelect(c.label)
          }}
          className="flex-shrink-0 px-4 py-2.5 rounded-full border border-primary/20 bg-white dark:bg-gray-800 text-primary text-sm font-medium hover:bg-primary/5 dark:hover:bg-primary/10 active:bg-primary/10 dark:active:bg-primary/15 transition-all touch-manipulation whitespace-nowrap snap-start shadow-sm"
        >
          {c.label}
        </motion.button>
      ))}
    </div>
  )
}

// ─── Message Bubble Component ─────────────────────────────

function MessageBubble({ 
  message, 
  isUser, 
  showAvatar, 
  showTime 
}: { 
  message: AiyaMessage
  isUser: boolean
  showAvatar: boolean
  showTime: boolean
}) {
  return (
    <div className={`flex items-end gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'} ${!showAvatar && !isUser ? 'ml-11 sm:ml-12' : ''}`}>
      {!isUser && showAvatar && (
        <div className="flex-shrink-0">
          <AiyaAvatar size={32} />
        </div>
      )}
      <div className="flex flex-col gap-1.5 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] lg:max-w-[55%]">
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`px-4 py-3 sm:px-5 sm:py-3.5 rounded-3xl shadow-sm ${
            isUser
              ? 'bg-gradient-to-br from-primary to-orange-500 text-white rounded-br-md shadow-md'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md border border-gray-100 dark:border-gray-700/50'
          }`}
        >
          <p className="text-[15px] sm:text-base leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </motion.div>
        {showTime && (
          <p className={`text-[11px] sm:text-xs px-1.5 ${isUser ? 'text-right text-gray-400 dark:text-gray-500' : 'text-left text-gray-400 dark:text-gray-500'}`}>
            {formatTime(message.ts)}
          </p>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// ─── Main Component ─────────────────────────────────────
// ═════════════════════════════════════════════════════════

export default function Aiya() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, setUser } = useStore()
  const userId = useUserId()
  const { memories } = useMemories(userId, { autoLoad: Boolean(user) })

  const locale = i18n.language || 'tr'

  // ─── Storage keys ──────────────────────────────────────
  const chatsKey = userId ? `aiya_chats_${userId}` : 'aiya_chats_local'
  const profileKey = userId ? `aiya_profile_${userId}` : 'aiya_profile_local'

  // ─── State ─────────────────────────────────────────────
  const [chats, setChats] = useState<AiyaChat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('list')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null)
  const [profileSummary, setProfileSummary] = useState('')
  const [profileMeta, setProfileMeta] = useState<AiyaProfileMeta | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; chatId: string | null }>({ isOpen: false, chatId: null })

  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Ref to always have latest chats — needed because React 18 batching
  // defers setState callbacks, so reading state via setChats() doesn't work
  const chatsRef = useRef(chats)
  chatsRef.current = chats

  // Ref for user — avoids triggering loadData re-runs when user fields change
  const userRef = useRef(user)
  userRef.current = user

  // ─── Reset state on user change (prevents cross-account data leak) ───
  const prevUserIdRef = useRef(userId)
  useEffect(() => {
    if (prevUserIdRef.current === userId) return
    prevUserIdRef.current = userId

    // Clear all chat state so the next user starts fresh
    setChats([])
    setActiveChatId(null)
    setView('list')
    setInput('')
    setSending(false)
    setErrorMessage(null)
    setUsage(null)
    setProfileSummary('')
    setProfileMeta(null)
    setLoaded(false)
    setShowMenu(false)
    setShowScrollDown(false)
  }, [userId])

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) ?? null, [chats, activeChatId])
  const messages = activeChat?.messages ?? []

  // Usage info - always use 50 as limit, use API used count if available
  const usageInfo = useMemo(() => {
    if (!user) return null
    
    // Always use 50 as limit (override any API or user value that might be 30)
    const limit = 50
    const userUsed = user.aiyaMessagesUsed || 0
    
    // If API provided usage, use its used count but always use 50 as limit
    if (usage) {
      return {
        used: usage.used,
        limit: limit // Always 50, never use API's limit
      }
    }
    
    // Fallback to user data
    return {
      used: userUsed,
      limit: limit // Always 50
    }
  }, [usage, user])

  // System prompt
  const systemPrompt = useMemo(() => {
    return t('aiyaSystemPrompt', { memories: '{{memories}}', profile: profileSummary || '' })
  }, [t, profileSummary])

  // ─── Auto-scroll ───────────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  // ─── Auto-resize textarea ──────────────────────────────
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 120) // Max 120px
    textarea.style.height = `${newHeight}px`
  }, [input])

  // ─── Keyboard handling ────────────────────────────────────
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || view !== 'chat') return

    const handleFocus = () => {
      // Scroll input into view when keyboard opens
      setTimeout(() => {
        textarea.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }, 300) // Delay to allow keyboard animation
    }

    const handleBlur = () => {
      // Scroll to bottom of messages when keyboard closes
      setTimeout(() => {
        scrollToBottom(false)
      }, 100)
    }

    // Visual Viewport API for better keyboard handling
    let viewport: VisualViewport | null = null
    if (window.visualViewport) {
      viewport = window.visualViewport
      const handleResize = () => {
        // Ensure input stays visible when keyboard opens/closes
        if (document.activeElement === textarea) {
          setTimeout(() => {
            textarea.scrollIntoView({ behavior: 'smooth', block: 'end' })
          }, 100)
        }
      }
      viewport.addEventListener('resize', handleResize)
      
      textarea.addEventListener('focus', handleFocus)
      textarea.addEventListener('blur', handleBlur)

      return () => {
        if (viewport) {
          viewport.removeEventListener('resize', handleResize)
        }
        textarea.removeEventListener('focus', handleFocus)
        textarea.removeEventListener('blur', handleBlur)
      }
    } else {
      // Fallback for browsers without Visual Viewport API
      textarea.addEventListener('focus', handleFocus)
      textarea.addEventListener('blur', handleBlur)

      return () => {
        textarea.removeEventListener('focus', handleFocus)
        textarea.removeEventListener('blur', handleBlur)
      }
    }
  }, [view, scrollToBottom])

  useEffect(() => {
    if (view === 'chat') scrollToBottom()
  }, [messages.length, sending, view, scrollToBottom])

  useEffect(() => {
    if (view === 'chat' && activeChatId) {
      // Multiple attempts to ensure scroll works on Android WebView
      scrollToBottom(false)
      const t1 = setTimeout(() => scrollToBottom(false), 100)
      const t2 = setTimeout(() => scrollToBottom(false), 300)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [activeChatId, view, scrollToBottom])

  // ─── Scroll-down button logic ──────────────────────────
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return
    const onScroll = () => {
      const threshold = 150
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
      setShowScrollDown(!isNearBottom && messages.length > 4)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [messages.length, view])

  // ─── Load from storage and sync ────────────────────────
  // IMPORTANT: Do NOT add `user` to deps — it changes on every aiyaMessagesUsed
  // update (via setUser in handleSend), which would re-run loadData and OVERWRITE
  // any in-flight chat messages with stale localStorage data. Use userRef instead.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      setLoaded(true)
      return
    }

    const loadData = async () => {
      // Read user from ref to avoid stale closures and unnecessary re-runs
      const currentUser = userRef.current

      try {
        // Step 1: Load from localStorage INSTANTLY (no async)
        let stored = loadJson<AiyaChat[]>(chatsKey)

        // Migration: Only migrate from the generic 'aiya_chats_local' key (same-device offline→login)
        // NEVER migrate between different user-specific keys to prevent cross-user contamination
        if (!stored || !Array.isArray(stored) || stored.length === 0) {
          const localKey = 'aiya_chats_local'
          if (localKey !== chatsKey) {
            const localStored = loadJson<AiyaChat[]>(localKey)
            if (localStored && Array.isArray(localStored) && localStored.length > 0) {
              stored = localStored
              try {
                localStorage.setItem(chatsKey, JSON.stringify(localStored))
                localStorage.removeItem(localKey)
              } catch {
                // Ignore migration errors
              }
            }
          }
        }

        // Show local data immediately
        if (stored && Array.isArray(stored) && stored.length > 0) {
          stored.sort((a, b) => b.updatedAt - a.updatedAt)
          setChats(stored)
          setLoaded(true) // Show UI immediately with local data
        }

        // Step 2: Load from Supabase in background (non-blocking)
        let cloudChats: AiyaChat[] | null = null
        if (userId && currentUser) {
          try {
            cloudChats = await aiyaService.loadChats(userId)
          } catch (err) {
            if (import.meta.env.DEV) {
              console.warn('[Aiya] Failed to load chats from cloud:', err)
            }
          }
        }

        // Step 3: Use FUNCTIONAL update to preserve any chats created during the async fetch
        const mergedFromCloud = cloudChats && Array.isArray(cloudChats) && cloudChats.length > 0 ? cloudChats : null

        if (mergedFromCloud || (stored && Array.isArray(stored) && stored.length > 0)) {
          setChats((prev) => {
            const sourceChats: AiyaChat[] = []

            if (mergedFromCloud) {
              const cloudMap = new Map(mergedFromCloud.map(c => [c.id, c]))
              const localMap = new Map((stored || []).map(c => [c.id, c]))
              const allIds = new Set([...cloudMap.keys(), ...localMap.keys()])

              for (const id of allIds) {
                const cloud = cloudMap.get(id)
                const local = localMap.get(id)
                if (cloud && local) {
                  sourceChats.push(cloud.updatedAt > local.updatedAt ? cloud : local)
                } else if (cloud) {
                  sourceChats.push(cloud)
                } else if (local) {
                  sourceChats.push(local)
                }
              }
            } else if (stored && Array.isArray(stored)) {
              sourceChats.push(...stored)
            }

            // Preserve any chats in current state that are NOT in the source
            const sourceIds = new Set(sourceChats.map(c => c.id))
            const newChatsInState = prev.filter(c => !sourceIds.has(c.id))

            const finalMap = new Map<string, AiyaChat>()
            for (const c of sourceChats) finalMap.set(c.id, c)
            for (const c of prev) {
              const existing = finalMap.get(c.id)
              if (existing && c.updatedAt > existing.updatedAt) {
                finalMap.set(c.id, c)
              }
            }
            for (const c of newChatsInState) finalMap.set(c.id, c)

            const result = Array.from(finalMap.values())
            result.sort((a, b) => b.updatedAt - a.updatedAt)

            saveJson(chatsKey, result)
            return result
          })

          // Sync to cloud if user is logged in
          if (userId && currentUser && mergedFromCloud) {
            setTimeout(() => {
              const current = chatsRef.current
              const needsSync = JSON.stringify(current) !== JSON.stringify(mergedFromCloud)
              if (needsSync) {
                aiyaService.syncChats(userId, current).catch((err: unknown) => {
                  if (import.meta.env.DEV) {
                    console.warn('[Aiya] Failed to sync chats to cloud:', err)
                  }
                })
              }
            }, 100)
          }

          if (import.meta.env.DEV) {
            console.log('[Aiya] Loaded and merged chats')
          }
        }

        // Load profile
        let storedProfile = loadJson<AiyaProfileMeta>(profileKey)

        // Only migrate profile from generic local key (not between user-specific keys)
        if (!storedProfile?.summary) {
          const localProfileKey = 'aiya_profile_local'
          if (localProfileKey !== profileKey) {
            const localProfile = loadJson<AiyaProfileMeta>(localProfileKey)
            if (localProfile?.summary) {
              storedProfile = localProfile
              try {
                localStorage.setItem(profileKey, JSON.stringify(localProfile))
                localStorage.removeItem(localProfileKey)
              } catch {
                // Ignore migration errors
              }
            }
          }
        }

        if (storedProfile?.summary) {
          setProfileSummary(storedProfile.summary)
          setProfileMeta(storedProfile)
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error loading Aiya chats:', error)
        }
      } finally {
        setLoaded(true)
      }
    }

    // Load immediately - no need for multiple delayed calls
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatsKey, profileKey, userId])

  // Debounce chats for Supabase sync
  const debouncedChats = useDebounce(chats, 2000)

  // ─── Persist chats to localStorage ─────────────────────
  useEffect(() => {
    if (!loaded) return
    if (chats.length === 0) return
    
    try {
      saveJson(chatsKey, chats)
      if (import.meta.env.DEV) {
        console.log(`[Aiya] Saved ${chats.length} chats to localStorage`)
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving Aiya chats to localStorage:', error)
      }
    }
  }, [loaded, chatsKey, chats])

  // ─── Sync chats to Supabase (debounced) ────────────────
  // Use userRef to avoid re-triggering on every user field change
  useEffect(() => {
    if (!loaded) return
    if (debouncedChats.length === 0) return
    if (!userId || !userRef.current) return

    aiyaService.syncChats(userId, debouncedChats).then(() => {
      if (import.meta.env.DEV) {
        console.log(`[Aiya] Synced ${debouncedChats.length} chats to Supabase`)
      }
    }).catch((err: unknown) => {
      if (import.meta.env.DEV) {
        console.warn('[Aiya] Failed to sync chats to Supabase:', err)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, userId, debouncedChats])

  useEffect(() => {
    if (!loaded || !profileMeta?.summary) return
    saveJson(profileKey, profileMeta)
  }, [loaded, profileMeta, profileKey])

  // ─── Draft helpers ───────────────────────────────────────
  const draftKey = activeChatId ? `${DRAFT_SAVE_KEY_PREFIX}${activeChatId}` : null

  const saveDraft = useCallback((chatId: string, text: string) => {
    const key = `${DRAFT_SAVE_KEY_PREFIX}${chatId}`
    if (text.trim()) {
      try { localStorage.setItem(key, text) } catch { /* ignore */ }
    } else {
      try { localStorage.removeItem(key) } catch { /* ignore */ }
    }
  }, [])

  const loadDraft = useCallback((chatId: string): string => {
    try { return localStorage.getItem(`${DRAFT_SAVE_KEY_PREFIX}${chatId}`) || '' } catch { return '' }
  }, [])

  // Save draft when input changes
  useEffect(() => {
    if (!activeChatId) return
    saveDraft(activeChatId, input)
  }, [input, activeChatId, saveDraft])

  // ─── Chat CRUD ─────────────────────────────────────────
  const createNewChat = useCallback(() => {
    const id = generateUUID()
    const chat: AiyaChat = { id, title: '', messages: [], createdAt: Date.now(), updatedAt: Date.now() }
    setChats((prev) => [chat, ...prev])
    setActiveChatId(id)
    setView('chat')
    setInput('')
    setErrorMessage(null)
    hapticFeedback('light')
    setTimeout(() => textareaRef.current?.focus(), 200)
  }, [])

  const openChat = useCallback((id: string) => {
    setActiveChatId(id)
    setView('chat')
    // Restore draft if available
    setInput(loadDraft(id))
    setErrorMessage(null)
    hapticFeedback('light')
    // Use requestAnimationFrame + setTimeout for reliable scroll on Android
    requestAnimationFrame(() => {
      setTimeout(() => scrollToBottom(false), 150)
    })
  }, [scrollToBottom, loadDraft])

  const deleteChat = useCallback((id: string) => {
    // Clean up draft
    saveDraft(id, '')
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (activeChatId === id) {
      setActiveChatId(null)
      setView('list')
    }
    hapticFeedback('success')
  }, [activeChatId, saveDraft])

  const goToList = useCallback(() => {
    // Save current draft before going to list
    if (activeChatId && input.trim()) {
      saveDraft(activeChatId, input)
    }
    setView('list')
    setShowMenu(false)
    hapticFeedback('light')
  }, [activeChatId, input, saveDraft])

  // ─── Profile update ────────────────────────────────────
  const maybeUpdateProfile = useCallback(async (nextMessages: AiyaMessage[]) => {
    const count = nextMessages.length
    if (count < PROFILE_MIN_MESSAGE_COUNT) return
    const lastUpdated = profileMeta?.updatedAt ?? 0
    const lastCount = profileMeta?.messageCount ?? 0
    const since = count - lastCount
    const cooldown = Date.now() - lastUpdated > PROFILE_UPDATE_COOLDOWN_MS
    if (since < PROFILE_UPDATE_MESSAGE_INTERVAL && !cooldown) return
    try {
      const res = await aiyaService.buildProfile({ memories, history: trimMessages(nextMessages), locale })
      const summary = res.profile?.trim()
      if (summary) {
        setProfileSummary(summary)
        setProfileMeta({ summary, messageCount: count, updatedAt: Date.now() })
      }
      if (res.usage) setUsage(res.usage)
    } catch { /* silent */ }
  }, [memories, locale, profileMeta])

  // ─── Send message ──────────────────────────────────────
  const handleSend = useCallback(async (overrideText?: string, overrideChatId?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || sending) return

    // Use overrideChatId if provided (from handleChip), otherwise use activeChatId from closure
    const targetChatId = overrideChatId ?? activeChatId

    console.warn('[Aiya] handleSend START — targetChatId:', targetChatId, '| activeChatId:', activeChatId, '| text:', text.slice(0, 30))

    setInput('')
    // Clear draft on send
    if (targetChatId) saveDraft(targetChatId, '')
    setErrorMessage(null)

    const userMsg: AiyaMessage = { role: 'user', content: text, ts: Date.now() }

    setChats((prev) => {
      const found = prev.some((c) => c.id === targetChatId)
      console.warn('[Aiya] Adding USER msg — chatFound:', found, '| targetChatId:', targetChatId, '| chats:', prev.length, '| chatIds:', prev.map(c => c.id.slice(0, 8)).join(','))
      return prev.map((c) => {
        if (c.id !== targetChatId) return c
        const updated = trimMessages([...c.messages, userMsg])
        const title = c.title || generateTitle(text, t)
        return { ...c, messages: updated, title, updatedAt: Date.now() }
      })
    })

    setSending(true)
    try {
      // Read history from ref — React 18 batching defers setChats callbacks,
      // so the old approach of reading via setChats((prev) => ...) returned []
      const currentChat = chatsRef.current.find((c) => c.id === targetChatId)
      const history = currentChat ? trimMessages(currentChat.messages) : []
      console.warn('[Aiya] Calling sendMessage — history length:', history.length, '| memories:', memories.length)
      const res = await aiyaService.sendMessage({ message: text, history, memories, locale, systemPrompt })

      // Guard against missing reply
      const replyText = res?.reply
      console.warn('[Aiya] Got reply — type:', typeof replyText, '| length:', typeof replyText === 'string' ? replyText.length : 'N/A', '| preview:', typeof replyText === 'string' ? replyText.slice(0, 50) : String(replyText))
      if (!replyText || typeof replyText !== 'string') {
        console.error('[Aiya] Invalid response - no reply field:', JSON.stringify(res).slice(0, 200))
        throw new Error(t('aiyaError', { defaultValue: 'Aiya yanıt veremedi, tekrar dene.' }))
      }

      const aiyaMsg: AiyaMessage = { role: 'assistant', content: cleanMarkdown(replyText), ts: Date.now() }

      setChats((prev) => {
        const found = prev.some((c) => c.id === targetChatId)
        console.warn('[Aiya] Adding AI msg — chatFound:', found, '| targetChatId:', targetChatId, '| chats:', prev.length, '| chatIds:', prev.map(c => c.id.slice(0, 8)).join(','))
        if (!found) {
          console.error('[Aiya] CRITICAL: Chat not found in state! AI message will be LOST. targetChatId:', targetChatId)
        }
        return prev.map((c) => {
          if (c.id !== targetChatId) return c
          const updated = trimMessages([...c.messages, aiyaMsg])
          return { ...c, messages: updated, updatedAt: Date.now() }
        })
      })

      if (res.usage) {
        setUsage(res.usage)
        // Also update the store so counter stays in sync across sessions
        // Use userRef to avoid adding `user` to deps (which would cause stale closures)
        const currentUser = userRef.current
        if (currentUser) {
          setUser({ ...currentUser, aiyaMessagesUsed: res.usage.used })
        }
      }

      void maybeUpdateProfile([...history, aiyaMsg])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Aiya] sendMessage failed:', msg, err)
      setErrorMessage(msg || t('aiyaError'))
    } finally {
      setSending(false)
    }
  }, [input, sending, activeChatId, memories, locale, systemPrompt, t, maybeUpdateProfile, saveDraft, setUser])

  // ─── Chip action ───────────────────────────────────────
  const handleChip = useCallback((text: string) => {
    if (!activeChatId) {
      const id = generateUUID()
      const chat: AiyaChat = { id, title: '', messages: [], createdAt: Date.now(), updatedAt: Date.now() }
      setChats((prev) => [chat, ...prev])
      setActiveChatId(id)
      setView('chat')
      // Pass the new chat ID explicitly to avoid stale closure — handleSend's
      // activeChatId would still be null from the old closure
      setTimeout(() => handleSend(text, id), 50)
    } else {
      handleSend(text)
    }
  }, [activeChatId, handleSend])

  // ─── Not logged in ─────────────────────────────────────
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] container-padding">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-8 shadow-card text-center max-w-sm w-full"
        >
          <div className="mx-auto mb-5">
            <AiyaAvatar size={56} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('aiyaTitle')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{t('aiyaLoginRequired')}</p>
          <button
            onClick={() => navigate('/profile')}
            className="w-full px-5 py-3 rounded-2xl gradient-primary text-white font-semibold hover:shadow-lg transition-all touch-manipulation"
          >
            {t('aiyaLoginCta')}
          </button>
        </motion.div>
      </div>
    )
  }

  // ═════════════════════════════════════════════════════════
  // ─── LIST VIEW ────────────────────────────────────────
  // ═════════════════════════════════════════════════════════

  const listView = (
    <div className="flex flex-col w-full h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div
        className="flex items-center justify-between container-padding py-4 sm:py-5 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl flex-shrink-0 shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <AiyaAvatar size={40} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">Aiya</h1>
            {usageInfo && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-20 sm:w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((usageInfo.used / usageInfo.limit) * 100, 100)}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full"
                  />
                </div>
                <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">{usageInfo.used}/{usageInfo.limit}</span>
              </div>
            )}
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={createNewChat}
          className="w-11 h-11 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors touch-manipulation shadow-sm"
          aria-label={t('aiyaNewChat', { defaultValue: 'Yeni Sohbet' })}
        >
          <Plus size={22} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'env(safe-area-inset-bottom, 0px)' } as React.CSSProperties}>
        {/* Hero / Start Chat section */}
        <div className={`flex flex-col items-center container-padding text-center ${chats.length === 0 ? 'justify-center h-full min-h-[400px]' : 'pt-8 sm:pt-10 pb-6'}`}>
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mb-4 sm:mb-6"
          >
            <AiyaAvatar size={chats.length === 0 ? 80 : 64} />
          </motion.div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('aiyaEmptyTitle', { defaultValue: 'Merhaba! Ben Aiya' })}
          </h2>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6 max-w-xs sm:max-w-sm leading-relaxed">
            {t('aiyaEmptyDesc', { defaultValue: 'Anılarını bilen, seni tanıyan özel asistanın. Hemen bir sohbet başlat!' })}
          </p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={createNewChat}
            className="px-6 py-3.5 rounded-2xl gradient-primary text-white font-semibold shadow-lg hover:shadow-xl transition-all touch-manipulation flex items-center gap-2 touch-target"
          >
            <MessageCircle size={20} />
            {t('aiyaStartChat', { defaultValue: 'Sohbet Başlat' })}
          </motion.button>
        </div>

        {/* Previous conversations list */}
        {chats.length > 0 && (
          <div className="container-padding pb-6 max-w-4xl mx-auto w-full">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex-shrink-0">
                {t('aiyaPreviousChats', { defaultValue: 'Önceki Konuşmalar' })}
              </span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              {chats.map((chat) => {
                const lastMsg = chat.messages[chat.messages.length - 1]
                const snippet = lastMsg
                  ? (lastMsg.role === 'assistant' ? 'Aiya: ' : '') + lastMsg.content.slice(0, 70) + (lastMsg.content.length > 70 ? '…' : '')
                  : t('aiyaEmptyChat', { defaultValue: 'Henüz mesaj yok' })
                const dateStr = formatDate(chat.updatedAt, locale)

                return (
                  <motion.div
                    key={chat.id}
                    role="button"
                    tabIndex={0}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openChat(chat.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openChat(chat.id) }}
                    className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 sm:py-4.5 bg-white dark:bg-gray-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-all duration-200 touch-manipulation text-left group shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700/50 touch-target cursor-pointer"
                  >
                    <AiyaAvatar size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[15px] sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {chat.title || t('aiyaNewChat', { defaultValue: 'Yeni Sohbet' })}
                        </p>
                        <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 font-medium">{dateStr}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] sm:text-sm text-gray-500 dark:text-gray-400 truncate leading-snug">{snippet}</p>
                        {chat.messages.length > 0 && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full font-medium">
                            {chat.messages.length}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        hapticFeedback('warning')
                        setDeleteConfirm({ isOpen: true, chatId: chat.id })
                      }}
                      className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 md:opacity-100 transition-all flex-shrink-0 touch-manipulation touch-target"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ═════════════════════════════════════════════════════════
  // ─── CHAT VIEW ────────────────────────────────────────
  // ═════════════════════════════════════════════════════════

  const showChips = (messages.length === 0 || (messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && !sending)) && input.length === 0

  const chatView = (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Chat header - Fixed top */}
      <div
        className="flex items-center justify-between gap-2 container-padding py-3.5 sm:py-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl flex-shrink-0 z-30 shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.875rem)' }}
      >
        <button
          onClick={goToList}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation touch-target"
          aria-label={t('back', { defaultValue: 'Geri' })}
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate">
            {activeChat?.title || t('aiyaNewChat', { defaultValue: 'Yeni Sohbet' })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { hapticFeedback('light'); createNewChat() }}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-colors touch-manipulation touch-target"
            aria-label={t('aiyaNewChat', { defaultValue: 'Yeni Sohbet' })}
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
          <div className="relative">
            <button
              onClick={() => { hapticFeedback('light'); setShowMenu(!showMenu) }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation touch-target"
            >
              <MoreVertical size={20} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-30"
                    onClick={() => setShowMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute right-0 top-12 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-1.5 min-w-[180px] overflow-hidden"
                  >
                    {activeChatId && (
                      <button
                        onClick={() => {
                          setShowMenu(false)
                          hapticFeedback('warning')
                          setDeleteConfirm({ isOpen: true, chatId: activeChatId })
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-sm font-medium text-red-500 transition-colors touch-manipulation"
                      >
                        <Trash2 size={16} />
                        {t('aiyaDeleteChat', { defaultValue: 'Sohbeti Sil' })}
                      </button>
                    )}
                    <button
                      onClick={() => setShowMenu(false)}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-sm transition-colors touch-manipulation"
                    >
                      <X size={16} className="text-gray-400" />
                      {t('close')}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Messages area - Scrollable, flex-1 */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain container-padding py-6 space-y-4 min-h-0"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        } as React.CSSProperties}
      >
        {/* Container for centering on desktop */}
        <div className="max-w-4xl mx-auto w-full">
          {/* Empty state for new chat */}
          {messages.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 min-h-[400px]">
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="mb-6"
              >
                <AiyaAvatar size={72} />
              </motion.div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {t('aiyaEmptyTitle', { defaultValue: 'Merhaba! Ben Aiya' })}
              </p>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6 max-w-[280px] sm:max-w-sm leading-relaxed">
                {t('aiyaEmptyState', { defaultValue: 'Anılarını bilen, seni tanıyan özel asistanın. Sorularını sorabilirsin!' })}
              </p>
            </div>
          )}

          {/* Chat bubbles */}
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            const prevMsg = idx > 0 ? messages[idx - 1] : null
            const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null
            const showAvatar = !isUser && (prevMsg?.role !== 'assistant' || !prevMsg)
            const showTime = !nextMsg || nextMsg.role !== msg.role || (nextMsg.ts && msg.ts && nextMsg.ts - msg.ts > 300000) // 5 minutes

            return (
              <MessageBubble
                key={`${msg.role}-${idx}-${msg.ts}`}
                message={msg}
                isUser={isUser}
                showAvatar={showAvatar}
                showTime={Boolean(showTime)}
              />
            )
          })}

          {/* Typing indicator */}
          {sending && <TypingDots />}

          {/* Error */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 my-2"
            >
              <div className="text-xs sm:text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 rounded-2xl">
                <p className="font-medium mb-1">{t('aiyaError')}</p>
                <p className="text-red-500 dark:text-red-300 break-words">{errorMessage}</p>
              </div>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Scroll-down FAB */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom()}
            className="absolute right-4 sm:right-6 w-11 h-11 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-lg flex items-center justify-center z-20 touch-manipulation touch-target"
            style={{ bottom: '100px' }}
          >
            <ChevronDown size={20} className="text-gray-600 dark:text-gray-300" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom: Input container - Fixed above navbar, z-50 */}
      <div
        className="flex-shrink-0 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl z-50 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Suggestion chips */}
        <AnimatePresence>
          {showChips && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="container-padding pt-3 pb-2 overflow-hidden"
            >
              <SuggestionChips onSelect={handleChip} memories={memories} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="flex items-end gap-2.5 container-padding py-3 max-w-4xl mx-auto w-full">
          <div className="flex-1 relative">
            <textarea
              id="aiya-message-input"
              name="aiya-message"
              autoComplete="off"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('aiyaPlaceholder', { defaultValue: 'Mesaj yaz...' })}
              className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-[15px] sm:text-base leading-relaxed focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none touch-manipulation resize-none overflow-hidden transition-all duration-200 shadow-sm"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={sending}
              rows={1}
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSend()}
            disabled={sending || !input.trim()}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl gradient-primary text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation flex-shrink-0 shadow-lg touch-target"
            aria-label={t('aiyaSend', { defaultValue: 'Gönder' })}
          >
            {sending ? <LoadingSpinner size="sm" /> : <Send size={20} />}
          </motion.button>
        </div>
      </div>
    </div>
  )

  // ═════════════════════════════════════════════════════════
  // ─── Render ───────────────────────────────────────────
  // ═════════════════════════════════════════════════════════

  return (
    <div className="relative bg-white dark:bg-gray-900 overflow-hidden h-[100dvh]">
      <AnimatePresence mode="wait" initial={false}>
        {view === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute inset-0"
          >
            {listView}
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute inset-0"
          >
            {chatView}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, chatId: null })}
        onConfirm={() => {
          if (deleteConfirm.chatId) deleteChat(deleteConfirm.chatId)
          setDeleteConfirm({ isOpen: false, chatId: null })
        }}
        title={t('aiyaDeleteChat', { defaultValue: 'Sohbeti Sil' })}
        message={t('aiyaDeleteChatConfirm', { defaultValue: 'Bu sohbeti silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.' })}
        type="danger"
      />
    </div>
  )
}
