import { supabase } from '../lib/supabase'
import { Memory, MemoryCategory, LifeArea } from '../types'
import { withTimeout } from '../utils/timeout'

type AiyaAction = 'chat' | 'category' | 'classify' | 'analysis'

type AiyaMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AiyaUsage = {
  used: number
  limit: number
}

type AiyaChatResponse = {
  reply: string
  usage?: AiyaUsage
}

type AiyaAnalysis = {
  emotionalTrends: string
  standoutMemories: string[]
  patterns: string
  recommendations: string
}

type AiyaAnalysisResponse = {
  analysis: AiyaAnalysis
  usage?: AiyaUsage
}

type AiyaChat = {
  id: string
  title: string
  messages: AiyaMessage[]
  createdAt: number
  updatedAt: number
}

type AiyaProfileResponse = {
  profile?: string
  usage?: AiyaUsage
}

const FUNCTION_NAME = 'aiya-chat'
const REQUEST_TIMEOUT_MS = 30000
const MAX_CONTEXT_MEMORIES = 40
const MAX_CONTEXT_CHARS = 6000

let lastSessionCheckAt = 0
let lastSessionOk = false

async function hasActiveSessionCached(): Promise<boolean> {
  const now = Date.now()
  if (now - lastSessionCheckAt < 5000) return lastSessionOk
  lastSessionCheckAt = now
  try {
    const { data } = await supabase.auth.getSession()
    lastSessionOk = Boolean(data.session)
    return lastSessionOk
  } catch {
    lastSessionOk = false
    return false
  }
}

function buildMemoryContext(memories: Memory[]): string {
  if (!memories.length) return ''
  const sorted = [...memories].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  let totalChars = 0
  const lines: string[] = []
  for (const memory of sorted.slice(0, MAX_CONTEXT_MEMORIES)) {
    const line = `- ${memory.date.split('T')[0]} | ${memory.category} | ${memory.text}`
    totalChars += line.length
    if (totalChars > MAX_CONTEXT_CHARS) break
    lines.push(line)
  }
  return lines.join('\n')
}

async function invokeAiya<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await withTimeout(
    supabase.functions.invoke(FUNCTION_NAME, { body: payload }),
    REQUEST_TIMEOUT_MS
  )

  if (response.error) {
    // Extract the actual error message from the Edge Function response
    const err = response.error
    let detail = ''

    if ('context' in err && err.context) {
      const ctx = err.context
      try {
        // context can be a Response object or a string depending on supabase-js version
        if (typeof ctx === 'string') {
          const parsed = JSON.parse(ctx)
          detail = parsed?.error || parsed?.message || ctx
        } else if (ctx && typeof (ctx as Response).json === 'function') {
          const body = await (ctx as Response).json()
          detail = body?.error || body?.message || ''
        }
      } catch {
        // If context is a plain string that's not JSON
        if (typeof ctx === 'string') detail = ctx
      }
    }

    const message = detail || err.message || 'Edge Function error'
    if (import.meta.env.DEV) console.error('[aiyaService] Function error:', message)
    throw new Error(message)
  }

  // Handle case where data might be null/undefined
  if (!response.data) {
    if (import.meta.env.DEV) console.error('[aiyaService] Function returned empty data')
    throw new Error('Aiya yanıt vermedi')
  }

  // Handle case where data is a Blob (Supabase may return Blob in Capacitor/production)
  let data: unknown = response.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      if (import.meta.env.DEV) console.warn('[aiyaService] Response was Blob, converting. Size:', data.size, 'Preview:', text.slice(0, 100))
      data = JSON.parse(text)
    } catch (blobErr) {
      if (import.meta.env.DEV) console.error('[aiyaService] Failed to parse Blob response:', blobErr)
      throw new Error('Aiya yanıtı okunamadı (Blob)')
    }
  }

  // Handle case where data is a string (needs parsing)
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      if (import.meta.env.DEV) console.error('[aiyaService] Failed to parse response string:', data)
      throw new Error('Aiya yanıtı okunamadı')
    }
  }

  // Handle ReadableStream (another possible Supabase return type)
  if (data && typeof data === 'object' && 'getReader' in data && typeof (data as ReadableStream).getReader === 'function') {
    try {
      const reader = (data as ReadableStream).getReader()
      const chunks: Uint8Array[] = []
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (value) chunks.push(value)
        if (done) break
      }
      const merged = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0))
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }
      const streamText = new TextDecoder().decode(merged)
      if (import.meta.env.DEV) console.warn('[aiyaService] Response was ReadableStream, converted. Preview:', streamText.slice(0, 100))
      data = JSON.parse(streamText)
    } catch (streamErr) {
      if (import.meta.env.DEV) console.error('[aiyaService] Failed to parse ReadableStream response:', streamErr)
      throw new Error('Aiya yanıtı okunamadı (Stream)')
    }
  }

  // Check if the function returned an error in the body (e.g. 429 usage limit)
  if (data && typeof data === 'object' && 'error' in data && !('reply' in data) && !('category' in data) && !('analysis' in data) && !('profile' in data)) {
    const errorMsg = (data as { error: string }).error
    if (import.meta.env.DEV) console.error('[aiyaService] Function returned error in body:', errorMsg)
    throw new Error(errorMsg || 'Aiya hatası')
  }

  return data as T
}

export const aiyaService = {
  async canUseAiya(): Promise<boolean> {
    return await hasActiveSessionCached()
  },

  async sendMessage(params: {
    message: string
    history: AiyaMessage[]
    memories: Memory[]
    locale?: string
    systemPrompt?: string
  }): Promise<AiyaChatResponse> {
    const { message, history, memories, locale, systemPrompt } = params
    const memoryContext = buildMemoryContext(memories)
    return await invokeAiya<AiyaChatResponse>({
      action: 'chat' satisfies AiyaAction,
      message,
      history,
      locale,
      systemPrompt,
      memoryContext,
      countUsage: true,
    })
  },

  async suggestCategory(text: string, locale?: string): Promise<MemoryCategory | null> {
    if (!text.trim()) return null
    if (!(await hasActiveSessionCached())) return null
    try {
      const response = await invokeAiya<{ category?: MemoryCategory | null }>({
        action: 'category' satisfies AiyaAction,
        message: text,
        locale,
        countUsage: false,
      })
      return response?.category ?? null
    } catch {
      return null
    }
  },

  async suggestCategoryAndLifeArea(text: string, locale?: string): Promise<{ category: MemoryCategory; lifeArea: LifeArea } | null> {
    if (!text.trim()) return null
    if (!(await hasActiveSessionCached())) return null
    try {
      const response = await invokeAiya<{ category?: MemoryCategory | null; lifeArea?: LifeArea | null }>({
        action: 'classify' satisfies AiyaAction,
        message: text,
        locale,
        countUsage: false,
      })
      if (!response?.category) return null
      return {
        category: response.category,
        lifeArea: response.lifeArea ?? 'uncategorized',
      }
    } catch {
      return null
    }
  },

  async analyzeMemories(params: {
    memories: Memory[]
    locale?: string
    systemPrompt?: string
  }): Promise<AiyaAnalysisResponse> {
    const { memories, locale, systemPrompt } = params
    const memoryContext = buildMemoryContext(memories)
    return await invokeAiya<AiyaAnalysisResponse>({
      action: 'analysis' satisfies AiyaAction,
      memoryContext,
      locale,
      systemPrompt,
      countUsage: true,
    })
  },

  async loadChats(userId: string): Promise<AiyaChat[] | null> {
    // Skip cloud operations for local/offline users — RLS would reject them
    if (userId.startsWith('local')) return null
    if (!(await hasActiveSessionCached())) return null
    try {
      // Select only needed columns — user_id is known, no need to transfer it back.
      // Limit to 20 most recent chats to avoid transferring massive message histories.
      const { data, error } = await supabase
        .from('aiya_chats')
        .select('id, title, messages, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20)

      if (error) throw error
      if (!data) return null

      return data.map((row: {
        id: string
        title: string
        messages: AiyaMessage[]
        created_at: string
        updated_at: string
      }) => ({
        id: row.id,
        title: row.title,
        messages: row.messages,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      }))
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[aiyaService] Failed to load chats:', error)
      }
      return null
    }
  },

  async syncChats(userId: string, chats: AiyaChat[]): Promise<void> {
    // Skip cloud sync for local/offline users — RLS would reject them
    if (userId.startsWith('local')) return
    if (!(await hasActiveSessionCached())) return
    if (!chats || chats.length === 0) return

    try {
      // Only sync chats that were recently updated (within the last 5 minutes)
      // instead of syncing ALL chats every time, which wastes egress bandwidth
      const FIVE_MINUTES = 5 * 60 * 1000
      const now = Date.now()
      const recentChats = chats.filter((c) => now - c.updatedAt < FIVE_MINUTES)

      if (recentChats.length === 0) return

      const chatsToSync = recentChats.map((chat) => ({
        id: chat.id,
        user_id: userId,
        title: chat.title,
        messages: chat.messages,
        created_at: new Date(chat.createdAt).toISOString(),
        updated_at: new Date(chat.updatedAt).toISOString(),
      }))

      const { error } = await supabase
        .from('aiya_chats')
        .upsert(chatsToSync, { onConflict: 'id' })

      if (error) {
        // Non-critical — log but don't throw to avoid blocking other syncs
        if (import.meta.env.DEV) {
          console.warn('[aiyaService] Failed to sync chats:', error.message)
        }
      }
    } catch (error) {
      // Non-critical — silently handle sync failure
      if (import.meta.env.DEV) {
        console.warn('[aiyaService] Failed to sync chats:', error)
      }
    }
  },

  async buildProfile(params: {
    memories: Memory[]
    history: AiyaMessage[]
    locale?: string
  }): Promise<AiyaProfileResponse> {
    const { memories, history, locale } = params
    const memoryContext = buildMemoryContext(memories)
    return await invokeAiya<AiyaProfileResponse>({
      action: 'chat' satisfies AiyaAction,
      message: 'Build a user profile based on the memories and conversation history.',
      history,
      locale,
      memoryContext,
      systemPrompt: 'You are a profile builder. Analyze the user\'s memories and conversation history to create a concise profile summary.',
      countUsage: true,
    })
  },
}
