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
const MAX_CONTEXT_MEMORIES = 80
const MAX_CONTEXT_CHARS = 16000
const STATS_HEADER_BUDGET = 1200

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

function buildMemoryStats(memories: Memory[]): string {
  if (memories.length < 3) return ''

  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Category distribution
  const catCounts: Record<string, number> = {}
  const areaCounts: Record<string, number> = {}
  const connectionCounts: Record<string, number> = {}
  let coreCount = 0
  let recentCount = 0
  let thisMonthCount = 0
  let totalIntensity = 0
  let intensityCount = 0
  const recentMoods: string[] = []

  for (const m of memories) {
    const mDate = new Date(m.date)

    // Categories
    const cat = m.category && m.category !== 'uncategorized' ? m.category : null
    if (cat) catCounts[cat] = (catCounts[cat] || 0) + 1

    // Life areas
    const area = m.lifeArea && m.lifeArea !== 'uncategorized' ? m.lifeArea : null
    if (area) areaCounts[area] = (areaCounts[area] || 0) + 1

    // Connections
    if (m.connections?.length) {
      for (const c of m.connections) {
        connectionCounts[c] = (connectionCounts[c] || 0) + 1
      }
    }

    // Core & intensity
    if (m.isCore) coreCount++
    if (m.intensity) {
      totalIntensity += m.intensity
      intensityCount++
    }

    // Recent
    if (mDate >= oneWeekAgo) {
      recentCount++
      if (cat) recentMoods.push(cat)
    }
    if (mDate >= oneMonthAgo) thisMonthCount++
  }

  const parts: string[] = [`[STATS] Total: ${memories.length} memories`]

  if (coreCount > 0) parts[0] += `, ${coreCount} CORE`
  if (intensityCount > 0) parts[0] += `, avg intensity: ${(totalIntensity / intensityCount).toFixed(1)}/10`

  // Top categories
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
  if (topCats.length) {
    parts.push(`[TOP EMOTIONS] ${topCats.map(([c, n]) => `${c}(${n})`).join(', ')}`)
  }

  // Life area balance
  const allAreas = ['personal', 'work', 'relationship', 'family', 'friends', 'hobby', 'travel', 'health']
  const activeAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])
  const missingAreas = allAreas.filter(a => !areaCounts[a])
  if (activeAreas.length) {
    parts.push(`[LIFE AREAS] Active: ${activeAreas.map(([a, n]) => `${a}(${n})`).join(', ')}${missingAreas.length ? ` | Empty: ${missingAreas.join(', ')}` : ''}`)
  }

  // Top connections
  const topConns = Object.entries(connectionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (topConns.length) {
    parts.push(`[KEY PEOPLE] ${topConns.map(([name, n]) => `${name}(${n})`).join(', ')}`)
  }

  // Recent activity
  if (recentCount > 0) {
    const recentMoodStr = recentMoods.length ? ` — mood: ${[...new Set(recentMoods)].join(', ')}` : ''
    parts.push(`[RECENT] ${recentCount} in last 7 days, ${thisMonthCount} in last 30 days${recentMoodStr}`)
  } else {
    parts.push(`[RECENT] No memories in last 7 days (last 30 days: ${thisMonthCount})`)
  }

  // Emotional trajectory — compare last 2 weeks vs previous 2 weeks
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  let recentIntensitySum = 0, recentIntensityN = 0
  let olderIntensitySum = 0, olderIntensityN = 0
  const recentCats: string[] = []
  const olderCats: string[] = []

  for (const m of memories) {
    const mDate = new Date(m.date)
    if (mDate >= twoWeeksAgo) {
      if (m.intensity) { recentIntensitySum += m.intensity; recentIntensityN++ }
      if (m.category && m.category !== 'uncategorized') recentCats.push(m.category)
    } else if (mDate >= fourWeeksAgo) {
      if (m.intensity) { olderIntensitySum += m.intensity; olderIntensityN++ }
      if (m.category && m.category !== 'uncategorized') olderCats.push(m.category)
    }
  }

  if (recentIntensityN >= 2 && olderIntensityN >= 2) {
    const recentAvg = recentIntensitySum / recentIntensityN
    const olderAvg = olderIntensitySum / olderIntensityN
    const diff = recentAvg - olderAvg
    const trend = diff > 0.5 ? 'RISING' : diff < -0.5 ? 'DECLINING' : 'STABLE'
    const recentTopMood = recentCats.length ? [...new Set(recentCats)].slice(0, 3).join(', ') : 'mixed'
    const olderTopMood = olderCats.length ? [...new Set(olderCats)].slice(0, 3).join(', ') : 'mixed'
    parts.push(`[EMOTIONAL TRAJECTORY] ${trend} (last 2wk avg: ${recentAvg.toFixed(1)}, prev 2wk avg: ${olderAvg.toFixed(1)}) | Recent mood: ${recentTopMood} → Was: ${olderTopMood}`)
  }

  // Core memories highlight
  const coreMemories = memories.filter(m => m.isCore).slice(0, 5)
  if (coreMemories.length > 0) {
    const coreHighlights = coreMemories.map(m => {
      const date = m.date.split('T')[0]
      const people = m.connections?.length ? ` (with: ${m.connections.join(', ')})` : ''
      return `${date}${people}: ${m.text.slice(0, 60)}${m.text.length > 60 ? '...' : ''}`
    })
    parts.push(`[⭐ CORE MEMORIES — most defining moments]\n${coreHighlights.join('\n')}`)
  }

  const header = parts.join('\n')
  return header.length <= STATS_HEADER_BUDGET ? header : header.slice(0, STATS_HEADER_BUDGET)
}

function buildMemoryContext(memories: Memory[]): string {
  if (!memories.length) return ''
  const sorted = [...memories].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Build stats header
  const statsHeader = buildMemoryStats(sorted)

  let totalChars = statsHeader.length
  const lines: string[] = []
  for (const memory of sorted.slice(0, MAX_CONTEXT_MEMORIES)) {
    const parts: string[] = [memory.date.split('T')[0]]

    // Category (prefer multi-select if available)
    const cats = memory.categories?.length ? memory.categories.filter(c => c !== 'uncategorized') : []
    if (cats.length) {
      parts.push(cats.join('+'))
    } else if (memory.category && memory.category !== 'uncategorized') {
      parts.push(memory.category)
    }

    // Life area
    if (memory.lifeArea && memory.lifeArea !== 'uncategorized') {
      parts.push(`[${memory.lifeArea}]`)
    }

    // Intensity & core flag
    if (memory.intensity) {
      parts.push(`intensity:${memory.intensity}/10`)
    }
    if (memory.isCore) {
      parts.push('⭐CORE')
    }

    // Connections (people, places, etc.)
    if (memory.connections?.length) {
      parts.push(`with:${memory.connections.join(',')}`)
    }

    // Memory text
    parts.push(memory.text)

    const line = `- ${parts.join(' | ')}`
    totalChars += line.length
    if (totalChars > MAX_CONTEXT_CHARS) break
    lines.push(line)
  }

  const memoriesBlock = lines.join('\n')
  return statsHeader ? `${statsHeader}\n\n${memoriesBlock}` : memoriesBlock
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
      action: 'profile' satisfies AiyaAction,
      history,
      locale,
      memoryContext,
      countUsage: false,
    })
  },
}
