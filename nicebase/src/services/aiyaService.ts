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
const STATS_HEADER_BUDGET = 2000

// ─── Message Router — "Gearbox" Architecture ──────────────
// Determines how much context is needed based on message content

export type MessageTier = 'casual' | 'normal' | 'deep' | 'crisis'

type RouteResult = {
  tier: MessageTier
  memoryCount: number    // how many memories to include
  includeStats: boolean  // whether to include stats header
  includeFullPrompt: boolean // whether to use full system prompt
}

// Keywords for tier detection (Turkish + English)
const CRISIS_WORDS = [
  'intihar', 'suicide', 'ölmek istiyorum', 'kendime zarar', 'self-harm', 'self harm',
  'yaşamak istemiyorum', 'hayatıma son', 'want to die', 'kill myself', 'ending it all',
  'kendimi öldür', 'dayanamıyorum artık', 'can not take it anymore', 'hayatımı bitir',
]

const DEEP_WORDS = [
  'çok kötüyüm', 'depresyon', 'depressed', 'kaybettim', 'ayrıldık', 'broke up',
  'ölüm', 'death', 'kayıp', 'loss', 'boşanma', 'divorce', 'kanser', 'cancer',
  'ihanet', 'betrayal', 'aldatma', 'cheated', 'travma', 'trauma', 'panik atak',
  'anxiety', 'anksiyete', 'çok üzgünüm', 'çaresiz', 'hopeless', 'yalnızım',
  'lonely', 'korku', 'afraid', 'terapi', 'therapy', 'psikoloj', 'psikiyatr',
  'hayatımın anlamı', 'meaning of life', 'ne yapacağımı bilmiyorum', 'çıkmaz',
  'anılarımı analiz', 'analyze my memories', 'beni tanı', 'beni anlat',
  'hayatım hakkında', 'about my life', 'geçmişim', 'my past',
]

const CASUAL_WORDS = [
  'naber', 'nasılsın', 'selam', 'merhaba', 'hey', 'hello', 'hi', 'nbr',
  'günaydın', 'iyi geceler', 'good morning', 'good night', 'n\'aber',
  'ne var ne yok', 'what\'s up', 'yo', 'sa', 'selamlar', 'heyy',
]

export function routeMessage(message: string, messageCountInChat: number): RouteResult {
  const lower = message.toLowerCase().trim()
  const length = message.length

  // Always full context for first message in a chat session
  if (messageCountInChat === 0) {
    return { tier: 'deep', memoryCount: MAX_CONTEXT_MEMORIES, includeStats: true, includeFullPrompt: true }
  }

  // CRISIS: always full everything
  if (CRISIS_WORDS.some(w => lower.includes(w))) {
    return { tier: 'crisis', memoryCount: MAX_CONTEXT_MEMORIES, includeStats: true, includeFullPrompt: true }
  }

  // DEEP: significant context needed
  if (DEEP_WORDS.some(w => lower.includes(w)) || length > 300) {
    return { tier: 'deep', memoryCount: 40, includeStats: true, includeFullPrompt: false }
  }

  // CASUAL: minimal context
  if ((CASUAL_WORDS.some(w => lower.includes(w)) || lower.match(/^.{0,2}$/)) && length < 60) {
    return { tier: 'casual', memoryCount: 5, includeStats: false, includeFullPrompt: false }
  }

  // NORMAL: moderate context
  return { tier: 'normal', memoryCount: 15, includeStats: true, includeFullPrompt: false }
}

// ─── Smart Memory Selector — find relevant memories ──────
function findRelevantMemories(memories: Memory[], message: string, limit: number): Memory[] {
  if (memories.length <= limit) return memories

  const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 3)

  const scored = memories.map(m => {
    let score = 0
    const text = m.text.toLowerCase()

    // Keyword overlap with message
    for (const word of words) {
      if (text.includes(word)) score += 2
    }

    // Connection name mentioned in message
    if (m.connections?.some(c => message.toLowerCase().includes(c.toLowerCase()))) score += 5

    // Core memory always important
    if (m.isCore) score += 4

    // Recency bonus
    const daysSince = (Date.now() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince < 7) score += 3
    else if (daysSince < 30) score += 2
    else if (daysSince < 90) score += 1

    // High intensity = important
    if (m.intensity && m.intensity >= 8) score += 2
    if (m.intensity && m.intensity >= 9) score += 1

    return { memory: m, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.memory)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // re-sort by date
}

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

  // Relationship dynamics — who's trending up/down in recent memories
  if (Object.keys(connectionCounts).length >= 2) {
    const recentConns: Record<string, number> = {}
    const olderConns: Record<string, number> = {}
    for (const m of memories) {
      const mDate = new Date(m.date)
      if (m.connections?.length) {
        for (const c of m.connections) {
          if (mDate >= oneMonthAgo) {
            recentConns[c] = (recentConns[c] || 0) + 1
          } else {
            olderConns[c] = (olderConns[c] || 0) + 1
          }
        }
      }
    }
    const dynamics: string[] = []
    const allNames = new Set([...Object.keys(recentConns), ...Object.keys(olderConns)])
    for (const name of allNames) {
      const recent = recentConns[name] || 0
      const older = olderConns[name] || 0
      if (recent > 0 && older === 0 && recent >= 2) dynamics.push(`${name}: NEW (${recent} recent)`)
      else if (recent === 0 && older >= 2) dynamics.push(`${name}: FADING (was ${older}, now 0)`)
      else if (recent >= older + 2) dynamics.push(`${name}: ↑ GROWING (${older}→${recent})`)
    }
    if (dynamics.length > 0) {
      parts.push(`[RELATIONSHIP DYNAMICS] ${dynamics.slice(0, 4).join(' | ')}`)
    }
  }

  // Thematic arc — what topics are emerging or fading
  if (memories.length >= 10) {
    const recentAreaCounts: Record<string, number> = {}
    const olderAreaCounts: Record<string, number> = {}
    for (const m of memories) {
      const mDate = new Date(m.date)
      const area = m.lifeArea && m.lifeArea !== 'uncategorized' ? m.lifeArea : null
      if (area) {
        if (mDate >= oneMonthAgo) recentAreaCounts[area] = (recentAreaCounts[area] || 0) + 1
        else olderAreaCounts[area] = (olderAreaCounts[area] || 0) + 1
      }
    }
    const shifts: string[] = []
    const allThemes = new Set([...Object.keys(recentAreaCounts), ...Object.keys(olderAreaCounts)])
    for (const theme of allThemes) {
      const recent = recentAreaCounts[theme] || 0
      const older = olderAreaCounts[theme] || 0
      if (recent >= 3 && older === 0) shifts.push(`${theme}: EMERGING`)
      else if (recent === 0 && older >= 3) shifts.push(`${theme}: DISAPPEARED`)
      else if (recent >= older + 3) shifts.push(`${theme}: ↑ RISING`)
    }
    if (shifts.length > 0) {
      parts.push(`[THEMATIC SHIFTS] ${shifts.slice(0, 3).join(' | ')}`)
    }
  }

  const header = parts.join('\n')
  return header.length <= STATS_HEADER_BUDGET ? header : header.slice(0, STATS_HEADER_BUDGET)
}

function formatMemoryLine(memory: Memory): string {
  const parts: string[] = [memory.date.split('T')[0]]

  const cats = memory.categories?.length ? memory.categories.filter(c => c !== 'uncategorized') : []
  if (cats.length) {
    parts.push(cats.join('+'))
  } else if (memory.category && memory.category !== 'uncategorized') {
    parts.push(memory.category)
  }

  if (memory.lifeArea && memory.lifeArea !== 'uncategorized') {
    parts.push(`[${memory.lifeArea}]`)
  }

  if (memory.intensity) {
    parts.push(`intensity:${memory.intensity}/10`)
  }
  if (memory.isCore) {
    parts.push('⭐CORE')
  }

  if (memory.connections?.length) {
    parts.push(`with:${memory.connections.join(',')}`)
  }

  parts.push(memory.text)
  return `- ${parts.join(' | ')}`
}

function buildMemoryContext(memories: Memory[]): string {
  if (!memories.length) return ''
  const sorted = [...memories].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const statsHeader = buildMemoryStats(sorted)

  let totalChars = statsHeader.length
  const lines: string[] = []
  for (const memory of sorted.slice(0, MAX_CONTEXT_MEMORIES)) {
    const line = formatMemoryLine(memory)
    totalChars += line.length
    if (totalChars > MAX_CONTEXT_CHARS) break
    lines.push(line)
  }

  const memoriesBlock = lines.join('\n')
  return statsHeader ? `${statsHeader}\n\n${memoriesBlock}` : memoriesBlock
}

// ─── Tiered Memory Context — the "gearbox" for memory ────
export function buildTieredMemoryContext(
  memories: Memory[],
  message: string,
  route: RouteResult
): string {
  if (!memories.length) return ''

  const sorted = [...memories].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Stats header — only if route says so
  const statsHeader = route.includeStats ? buildMemoryStats(sorted) : ''

  // Select memories based on tier
  const selected = route.memoryCount >= MAX_CONTEXT_MEMORIES
    ? sorted.slice(0, MAX_CONTEXT_MEMORIES)
    : findRelevantMemories(sorted, message, route.memoryCount)

  // Build memory lines with char budget
  const charBudget = route.tier === 'casual' ? 3000
    : route.tier === 'normal' ? 8000
    : MAX_CONTEXT_CHARS

  let totalChars = statsHeader.length
  const lines: string[] = []
  for (const memory of selected) {
    const line = formatMemoryLine(memory)
    totalChars += line.length
    if (totalChars > charBudget) break
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
    memoryContext?: string // pre-built tiered context (if provided, skips default build)
  }): Promise<AiyaChatResponse> {
    const { message, history, memories, locale, systemPrompt, memoryContext } = params
    const ctx = memoryContext ?? buildMemoryContext(memories)
    return await invokeAiya<AiyaChatResponse>({
      action: 'chat' satisfies AiyaAction,
      message,
      history,
      locale,
      systemPrompt,
      memoryContext: ctx,
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
