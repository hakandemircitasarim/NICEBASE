import { supabase } from '../lib/supabase'
import { Memory, MemoryCategory, LifeArea } from '../types'
import { withTimeout } from '../utils/timeout'

type AiyaAction = 'chat' | 'category' | 'classify' | 'analysis' | 'profile'

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

type AiyaProfileResponse = {
  profile: string
  usage?: AiyaUsage
}

const FUNCTION_NAME = 'aiya-chat'
const REQUEST_TIMEOUT_MS = 30000
const MAX_CONTEXT_MEMORIES = 60
const MAX_CONTEXT_CHARS = 10000

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

function extractFunctionErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : ''

  // Try context.body (FunctionsHttpError structure)
  const context = (error as { context?: { body?: unknown } }).context
  const body = context?.body
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { error?: string }
      if (parsed?.error) return parsed.error
    } catch {
      // If body is a non-JSON string, use it directly if short enough
      if (body.trim().length > 0 && body.length < 300) return body.trim()
    }
  } else if (body && typeof body === 'object' && 'error' in body) {
    const bodyError = (body as { error?: unknown }).error
    if (typeof bodyError === 'string' && bodyError.trim()) return bodyError
  }

  // Try direct error property (some Supabase versions)
  if ('error' in error) {
    const directError = (error as { error?: unknown }).error
    if (typeof directError === 'string' && directError.trim()) return directError
  }

  return message || null
}

async function invokeAiya<T>(payload: Record<string, unknown>): Promise<T> {
  // Ensure we have an active session before calling edge functions
  const hasSession = await hasActiveSessionCached()
  if (!hasSession) {
    throw new Error('No active session. Please log in again.')
  }

  const response = await withTimeout(
    supabase.functions.invoke(FUNCTION_NAME, { body: payload }),
    REQUEST_TIMEOUT_MS
  )

  if (response.error) {
    const detail = extractFunctionErrorMessage(response.error)
    throw new Error(detail || response.error.message || 'Aiya request failed')
  }

  // Validate that we got actual data back
  if (response.data === null || response.data === undefined) {
    throw new Error('Empty response from Aiya')
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

  /**
   * Classify a memory text into both category AND lifeArea using AI.
   * Returns null on failure (non-blocking, used post-save).
   */
  async classifyMemory(text: string, locale?: string): Promise<{ category: MemoryCategory; lifeArea: LifeArea } | null> {
    if (!text.trim()) return null
    if (!(await hasActiveSessionCached())) return null
    try {
      const response = await invokeAiya<{ category?: string; lifeArea?: string }>({
        action: 'classify' satisfies AiyaAction,
        message: text,
        locale,
        countUsage: false,
      })
      if (!response) return null
      const category = (response.category || 'gratitude') as MemoryCategory
      const lifeArea = (response.lifeArea || 'personal') as LifeArea
      return { category, lifeArea }
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

  async buildProfile(params: {
    memories: Memory[]
    history: AiyaMessage[]
    locale?: string
  }): Promise<AiyaProfileResponse> {
    const { memories, history, locale } = params
    const memoryContext = buildMemoryContext(memories)
    return await invokeAiya<AiyaProfileResponse>({
      action: 'profile' satisfies AiyaAction,
      memoryContext,
      history,
      locale,
      countUsage: false,
    })
  },
}
