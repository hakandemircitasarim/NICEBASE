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

    // FunctionsHttpError has a context with the response body
    if ('context' in err && err.context) {
      try {
        const ctx = err.context as Response
        if (typeof ctx.json === 'function') {
          const body = await ctx.json()
          detail = body?.error || body?.message || ''
        }
      } catch {
        // Could not parse response body
      }
    }

    const message = detail || err.message || 'Edge Function error'
    throw new Error(message)
  }

  return response.data as T
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
    if (!(await hasActiveSessionCached())) return null
    try {
      const { data, error } = await supabase
        .from('aiya_chats')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) throw error
      if (!data) return null

      return data.map((row: {
        id: string
        user_id: string
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
    if (!(await hasActiveSessionCached())) return
    if (!chats || chats.length === 0) return

    try {
      // Upsert all chats
      const chatsToSync = chats.map((chat) => ({
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
