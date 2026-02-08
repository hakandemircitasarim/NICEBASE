import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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

// ─── Helpers ─────────────────────────────────────────────

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
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
    // Quota exceeded or private mode
    if (import.meta.env.DEV) {
      console.warn(`Failed to save to localStorage key "${key}":`, error)
    }
    return false
  }
}

function trimMessages(msgs: AiyaMessage[]) {
  return msgs.slice(-HISTORY_LIMIT)
}

function generateTitle(msg: string, t: (k: string, o?: any) => string): string {
  const cleaned = msg.trim().replace(/\n/g, ' ')
  if (cleaned.length >= 10) return cleaned.slice(0, 40) + (cleaned.length > 40 ? '…' : '')
  return t('aiyaNewChat', { defaultValue: 'Yeni Sohbet' }) + ' — ' + new Date().toLocaleDateString()
}

function formatTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function cleanMarkdown(text: string): string {
  // Remove markdown formatting like *text* (bold/italic), **text** (bold), _text_ (italic)
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold**
    .replace(/\*([^*]+)\*/g, '$1') // *italic* or *bold*
    .replace(/_([^_]+)_/g, '$1') // _italic_
    .replace(/`([^`]+)`/g, '$1') // `code`
    .replace(/~~([^~]+)~~/g, '$1') // ~~strikethrough~~
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
    <div className="flex items-end gap-2 mb-3">
      <AiyaAvatar size={28} />
      <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
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
  memories: any[]
}) {
  const { t } = useTranslation()
  
  // Generate personalized suggestions based on memories
  const getPersonalizedSuggestions = useMemo(() => {
    const baseChips = [
      { key: 'analyze', label: t('aiyaChipAnalyze', { defaultValue: 'Anılarımı analiz et' }) },
      { key: 'mood', label: t('aiyaChipMood', { defaultValue: 'Bugün nasılım?' }) },
      { key: 'motivate', label: t('aiyaChipMotivate', { defaultValue: 'Beni motive et' }) },
      { key: 'week', label: t('aiyaChipWeek', { defaultValue: 'Son haftamı özetle' }) },
    ]
    
    if (memories.length === 0) return baseChips
    
    // Analyze memories to generate personalized suggestions
    const recentMemories = memories.slice(0, 10)
    const categories = new Set(recentMemories.map(m => m.category))
    const connections = new Set(recentMemories.flatMap(m => m.connections))
    
    const personalized: Array<{ key: string; label: string }> = []
    
    // Add category-based suggestions
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
    
    // Add connection-based suggestions
    if (connections.size > 0) {
      const topConnection = Array.from(connections)[0]
      personalized.push({ 
        key: 'connection', 
        label: t('aiyaChipConnection', { defaultValue: `${topConnection} ile anılarım` }) 
      })
    }
    
    // Combine base and personalized, limit to 6 total
    return [...baseChips, ...personalized].slice(0, 6)
  }, [memories, t])
  
  const chips = getPersonalizedSuggestions

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
      {chips.map((c) => (
        <motion.button
          key={c.key}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            hapticFeedback('light')
            onSelect(c.label)
          }}
          className="flex-shrink-0 px-3.5 py-2 rounded-full border border-primary/25 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors touch-manipulation whitespace-nowrap"
        >
          {c.label}
        </motion.button>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// ─── Main Component ─────────────────────────────────────
// ═════════════════════════════════════════════════════════

export default function Aiya() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useStore()
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
  const inputRef = useRef<HTMLInputElement>(null)

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) ?? null, [chats, activeChatId])
  const messages = activeChat?.messages ?? []

  // System prompt
  const systemPrompt = useMemo(() => {
    return t('aiyaSystemPrompt', { memories: '{{memories}}', profile: profileSummary || '' })
  }, [t, profileSummary])

  // ─── Save/restore input state ──────────────────────────
  useEffect(() => {
    if (view === 'chat' && activeChatId) {
      try {
        sessionStorage.setItem(`aiya_input_${userId}_${activeChatId}`, input)
      } catch (error) {
        // Ignore sessionStorage errors
      }
    }
  }, [input, view, activeChatId, userId])

  useEffect(() => {
    if (view === 'chat' && activeChatId) {
      try {
        const saved = sessionStorage.getItem(`aiya_input_${userId}_${activeChatId}`)
        if (saved && !input) {
          setInput(saved)
        }
      } catch (error) {
        // Ignore sessionStorage errors
      }
    }
  }, [view, activeChatId, userId]) // Only run when chat opens

  // ─── Load from storage ─────────────────────────────────
  useEffect(() => {
    // Ensure localStorage is available (important for mobile)
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      setLoaded(true)
      return
    }

    // Aggressive loading strategy for mobile
    const loadData = () => {
      try {
        // Try current key first
        let stored = loadJson<AiyaChat[]>(chatsKey)
        
        // If no data found, try to find any aiya_chats key (migration support)
        if (!stored || !Array.isArray(stored) || stored.length === 0) {
          // Search all localStorage keys for aiya chats
          const allKeys: string[] = []
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key && key.startsWith('aiya_chats')) {
                allKeys.push(key)
              }
            }
          } catch (e) {
            // Ignore errors during key enumeration
          }
          
          // Try to load from any found key
          for (const key of allKeys) {
            const candidate = loadJson<AiyaChat[]>(key)
            if (candidate && Array.isArray(candidate) && candidate.length > 0) {
              stored = candidate
              // Migrate to current key
              if (key !== chatsKey) {
                try {
                  localStorage.setItem(chatsKey, JSON.stringify(candidate))
                  localStorage.removeItem(key) // Clean up old key
                } catch (e) {
                  // Ignore migration errors
                }
              }
              break
            }
          }
        }
        
        // Set chats if we found any
        if (stored && Array.isArray(stored) && stored.length > 0) {
          const sorted = [...stored].sort((a, b) => b.updatedAt - a.updatedAt)
          setChats(sorted)
          if (import.meta.env.DEV) {
            console.log(`[Aiya] Loaded ${sorted.length} chats from storage`)
          }
        } else {
          if (import.meta.env.DEV) {
            console.log('[Aiya] No chats found in storage')
          }
        }
        
        // Load profile
        let storedProfile = loadJson<AiyaProfileMeta>(profileKey)
        
        // Try to find profile in any key
        if (!storedProfile?.summary) {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key && key.startsWith('aiya_profile')) {
                const candidate = loadJson<AiyaProfileMeta>(key)
                if (candidate?.summary) {
                  storedProfile = candidate
                  // Migrate to current key
                  if (key !== profileKey) {
                    try {
                      localStorage.setItem(profileKey, JSON.stringify(candidate))
                      localStorage.removeItem(key)
                    } catch (e) {
                      // Ignore migration errors
                    }
                  }
                  break
                }
              }
            }
          } catch (e) {
            // Ignore errors
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

    // On mobile, wait longer for platform to be ready
    if (typeof window !== 'undefined' && 'Capacitor' in window) {
      // Try multiple times with increasing delays
      setTimeout(loadData, 100)
      setTimeout(loadData, 500)
      setTimeout(loadData, 1000)
    } else {
      loadData()
    }
  }, [chatsKey, profileKey])

  // ─── Persist chats ─────────────────────────────────────
  useEffect(() => {
    if (!loaded) return
    if (chats.length === 0) return // Don't save empty array on initial load
    
    try {
      saveJson(chatsKey, chats)
      if (import.meta.env.DEV) {
        console.log(`[Aiya] Saved ${chats.length} chats to storage`)
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving Aiya chats:', error)
      }
    }
  }, [loaded, chatsKey, chats])

  useEffect(() => {
    if (!loaded || !profileMeta?.summary) return
    saveJson(profileKey, profileMeta)
  }, [loaded, profileMeta, profileKey])

  // ─── Auto-scroll ───────────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => {
    if (view === 'chat') scrollToBottom()
  }, [messages.length, sending, view, scrollToBottom])

  // Scroll to bottom when opening a chat
  useEffect(() => {
    if (view === 'chat' && activeChatId) {
      setTimeout(() => {
        scrollToBottom(false)
      }, 100)
    }
  }, [activeChatId, view, scrollToBottom])

  // ─── Scroll-down button logic ──────────────────────────
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return
    const onScroll = () => {
      const threshold = 120
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
      setShowScrollDown(!isNearBottom && messages.length > 4)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [messages.length, view])

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
    setTimeout(() => inputRef.current?.focus(), 200)
  }, [])

  const openChat = useCallback((id: string) => {
    setActiveChatId(id)
    setView('chat')
    setInput('')
    setErrorMessage(null)
    hapticFeedback('light')
    setTimeout(() => scrollToBottom(false), 50)
  }, [scrollToBottom])

  const deleteChat = useCallback((id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (activeChatId === id) {
      setActiveChatId(null)
      setView('list')
    }
    hapticFeedback('success')
  }, [activeChatId])

  const goToList = useCallback(() => {
    setView('list')
    setShowMenu(false)
    hapticFeedback('light')
  }, [])

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
  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || sending) return
    setInput('')
    setErrorMessage(null)

    const userMsg: AiyaMessage = { role: 'user', content: text, ts: Date.now() }

    // Update active chat
    setChats((prev) => prev.map((c) => {
      if (c.id !== activeChatId) return c
      const updated = trimMessages([...c.messages, userMsg])
      const title = c.title || generateTitle(text, t)
      return { ...c, messages: updated, title, updatedAt: Date.now() }
    }))

    setSending(true)
    try {
      const currentChat = chats.find((c) => c.id === activeChatId)
      const history = currentChat?.messages ?? []
      const res = await aiyaService.sendMessage({ message: text, history, memories, locale, systemPrompt })
      const aiyaMsg: AiyaMessage = { role: 'assistant', content: cleanMarkdown(res.reply), ts: Date.now() }

      setChats((prev) => prev.map((c) => {
        if (c.id !== activeChatId) return c
        const updated = trimMessages([...c.messages, aiyaMsg])
        return { ...c, messages: updated, updatedAt: Date.now() }
      }))

      if (res.usage) setUsage(res.usage)

      // Background profile update
      const allMsgs = [...(currentChat?.messages ?? []), userMsg, aiyaMsg]
      void maybeUpdateProfile(allMsgs)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('aiyaError'))
    } finally {
      setSending(false)
    }
  }, [input, sending, activeChatId, chats, memories, locale, systemPrompt, t, maybeUpdateProfile])

  // ─── Chip action ───────────────────────────────────────
  const handleChip = useCallback((text: string) => {
    if (!activeChatId) {
      // Create chat first then send
      const id = generateUUID()
      const chat: AiyaChat = { id, title: '', messages: [], createdAt: Date.now(), updatedAt: Date.now() }
      setChats((prev) => [chat, ...prev])
      setActiveChatId(id)
      setView('chat')
      // Need to wait a tick for state to settle
      setTimeout(() => handleSend(text), 50)
    } else {
      handleSend(text)
    }
  }, [activeChatId, handleSend])

  // ─── Not logged in ─────────────────────────────────────
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-5">
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
    <div className="flex flex-col w-full" style={{ height: 'calc(100dvh - 5rem - env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg flex-shrink-0 safe-area-top" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-center gap-3">
          <AiyaAvatar size={36} />
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">Aiya</h1>
            {usage && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-14 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full transition-all"
                    style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400">{usage.used}/{usage.limit}</span>
              </div>
            )}
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={createNewChat}
          className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors touch-manipulation"
          aria-label={t('aiyaNewChat', { defaultValue: 'Yeni Sohbet' })}
        >
          <Plus size={20} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain w-full" style={{ WebkitOverflowScrolling: 'touch' as any }}>

        {/* ── Hero / Start Chat section ── */}
        <div className={`flex flex-col items-center px-8 text-center ${chats.length === 0 ? 'justify-center h-full' : 'pt-8 pb-4'}`}>
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mb-5"
          >
            <AiyaAvatar size={chats.length === 0 ? 72 : 56} />
          </motion.div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('aiyaEmptyTitle', { defaultValue: 'Merhaba! Ben Aiya' })}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-xs leading-relaxed">
            {t('aiyaEmptyDesc', { defaultValue: 'Anılarını bilen, seni tanıyan özel asistanın. Hemen bir sohbet başlat!' })}
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={createNewChat}
            className="px-6 py-3 rounded-2xl gradient-primary text-white font-semibold shadow-lg hover:shadow-xl transition-all touch-manipulation flex items-center gap-2"
          >
            <MessageCircle size={18} />
            {t('aiyaStartChat', { defaultValue: 'Sohbet Başlat' })}
          </motion.button>
        </div>

        {/* ── Previous conversations list ── */}
        {chats.length > 0 && (
          <div className="mt-2">
            {/* Section header */}
            <div className="flex items-center gap-3 px-5 pb-2 pt-3">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex-shrink-0">
                {t('aiyaPreviousChats', { defaultValue: 'Önceki Konuşmalar' })}
              </span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            <div className="py-1">
              {chats.map((chat) => {
                const lastMsg = chat.messages[chat.messages.length - 1]
                const snippet = lastMsg
                  ? (lastMsg.role === 'assistant' ? 'Aiya: ' : '') + lastMsg.content.slice(0, 60) + (lastMsg.content.length > 60 ? '…' : '')
                  : t('aiyaEmptyChat', { defaultValue: 'Henüz mesaj yok' })
                const dateStr = new Date(chat.updatedAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })

                return (
                  <motion.button
                    key={chat.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openChat(chat.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation text-left group"
                  >
                    <AiyaAvatar size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {chat.title || t('aiyaNewChat', { defaultValue: 'Yeni Sohbet' })}
                        </p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{dateStr}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{snippet}</p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                          {chat.messages.length}
                        </span>
                      </div>
                    </div>
                    {/* Delete on hover (desktop) */}
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        hapticFeedback('warning')
                        setDeleteConfirm({ isOpen: true, chatId: chat.id })
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 touch-manipulation"
                    >
                      <Trash2 size={15} />
                    </motion.div>
                  </motion.button>
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
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 5rem - env(safe-area-inset-bottom, 0px))' }}>
      {/* Chat header */}
      <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg flex-shrink-0 safe-area-top z-10" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
        <button
          onClick={goToList}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
          aria-label={t('back', { defaultValue: 'Geri' })}
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {activeChat?.title || t('aiyaNewChat', { defaultValue: 'Yeni Sohbet' })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { hapticFeedback('light'); createNewChat() }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-colors touch-manipulation"
            aria-label={t('aiyaNewChat', { defaultValue: 'Yeni Sohbet' })}
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
          <div className="relative">
            <button
              onClick={() => { hapticFeedback('light'); setShowMenu(!showMenu) }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            >
              <MoreVertical size={18} />
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
                    initial={{ opacity: 0, scale: 0.9, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -5 }}
                    className="absolute right-0 top-11 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-1.5 min-w-[180px] overflow-hidden"
                  >
                    {activeChatId && (
                      <button
                        onClick={() => {
                          setShowMenu(false)
                          hapticFeedback('warning')
                          setDeleteConfirm({ isOpen: true, chatId: activeChatId })
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-sm font-medium text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                        {t('aiyaDeleteChat', { defaultValue: 'Sohbeti Sil' })}
                      </button>
                    )}
                    <button
                      onClick={() => setShowMenu(false)}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 text-sm transition-colors"
                    >
                      <X size={15} className="text-gray-400" />
                      {t('close')}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain overscroll-y-contain px-4 py-4 space-y-1 min-h-0"
        style={{ WebkitOverflowScrolling: 'touch' as any }}
      >
        {/* Empty state for new chat */}
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-5"
            >
              <AiyaAvatar size={64} />
            </motion.div>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
              {t('aiyaEmptyTitle', { defaultValue: 'Merhaba! Ben Aiya' })}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 max-w-[260px] leading-relaxed">
              {t('aiyaEmptyState', { defaultValue: 'Anılarını bilen, seni tanıyan özel asistanın. Sorularını sorabilirsin!' })}
            </p>
          </div>
        )}

        {/* Chat bubbles */}
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user'
          const prevMsg = idx > 0 ? messages[idx - 1] : null
          const showAvatar = !isUser && prevMsg?.role !== 'assistant'

          return (
            <motion.div
              key={`${msg.role}-${idx}-${msg.ts}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'} ${
                !showAvatar && !isUser ? 'ml-9' : ''
              }`}
            >
              {!isUser && showAvatar && <AiyaAvatar size={28} />}
              <div
                className={`max-w-[80%] px-3.5 py-2.5 text-[14px] leading-relaxed ${
                  isUser
                    ? 'bg-gradient-to-br from-primary to-orange-500 text-white rounded-2xl rounded-br-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-bl-md'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-[9px] mt-1 ${isUser ? 'text-white/60 text-right' : 'text-gray-400'}`}>
                  {formatTime(msg.ts)}
                </p>
              </div>
            </motion.div>
          )
        })}

        {/* Typing indicator */}
        {sending && <TypingDots />}

        {/* Error */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <p className="inline-block text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-full">
              {errorMessage}
            </p>
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Scroll-down FAB */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 right-4 w-9 h-9 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-lg flex items-center justify-center z-20 touch-manipulation"
          >
            <ChevronDown size={18} className="text-gray-600 dark:text-gray-300" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom: chips + input */}
      <div className="flex-shrink-0 sticky bottom-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + env(keyboard-inset-height, 0px))' }}>
        {/* Suggestion chips */}
        <AnimatePresence>
          {showChips && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pt-2.5 pb-1 overflow-hidden"
            >
              <SuggestionChips onSelect={handleChip} memories={memories} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="flex items-end gap-2 px-3 py-2.5">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('aiyaPlaceholder')}
            className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none touch-manipulation"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            disabled={sending}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSend()}
            disabled={sending || !input.trim()}
            className="w-10 h-10 rounded-2xl gradient-primary text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation flex-shrink-0"
            aria-label={t('aiyaSend')}
          >
            {sending ? <LoadingSpinner size="sm" /> : <Send size={17} />}
          </motion.button>
        </div>
      </div>
    </div>
  )

  // ═════════════════════════════════════════════════════════
  // ─── Render ───────────────────────────────────────────
  // ═════════════════════════════════════════════════════════

  return (
    <div className="bg-white dark:bg-gray-900 relative">
      <AnimatePresence mode="wait" initial={false}>
        {view === 'list' ? (
          <motion.div
            key="list"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -30, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {listView}
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 30, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
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
