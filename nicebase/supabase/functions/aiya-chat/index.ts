import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''

const MODEL = 'gpt-4o'
const MODEL_MINI = 'gpt-4o-mini' // Used for classification tasks (16x cheaper input)
const CHAT_MAX_TOKENS = 2000
const CHAT_TEMPERATURE = 0.88
const CHAT_FREQUENCY_PENALTY = 0.35
const CHAT_PRESENCE_PENALTY = 0.5
const CHAT_TOP_P = 0.92
const DEFAULT_LIMIT = 50

// Server-side burst rate limits (independent of the daily message quota).
// chat/analysis/profile share the 'chat' bucket; classify/category share
// the cheaper-but-unmetered 'classify' bucket.
const RATE_CHAT_MAX = 20
const RATE_CHAT_WINDOW_S = 60
const RATE_CLASSIFY_MAX = 40
const RATE_CLASSIFY_WINDOW_S = 60

// Actions whose OpenAI call counts against the user's message quota.
// NOT 'profile': the profile build is an automatic background call (every few
// messages) — it's rate-limited but must not silently eat the visible quota.
const COUNTED_ACTIONS = new Set(['chat', 'analysis'])

const ALLOWED_CATEGORIES = [
  'success',
  'peace',
  'fun',
  'love',
  'gratitude',
  'inspiration',
  'growth',
  'adventure',
] as const

const ALLOWED_LIFE_AREAS = [
  'personal',
  'work',
  'relationship',
  'family',
  'friends',
  'hobby',
  'travel',
  'health',
] as const

type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number]
type AllowedLifeArea = (typeof ALLOWED_LIFE_AREAS)[number]

type AiyaRequest = {
  action: 'chat' | 'category' | 'classify' | 'analysis' | 'profile'
  message?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  memoryContext?: string
  locale?: string
  systemPrompt?: string
  // countUsage is intentionally NOT trusted from the client — the server
  // decides which actions are billed (see COUNTED_ACTIONS).
  crisis?: boolean
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function normalizeSystemPrompt(systemPrompt: string | undefined, memoryContext: string | undefined) {
  if (!systemPrompt) {
    return memoryContext ? `User memories:\n${memoryContext}` : ''
  }
  if (!memoryContext) return systemPrompt
  return systemPrompt.includes('{{memories}}')
    ? systemPrompt.replace('{{memories}}', memoryContext)
    : `${systemPrompt}\n\n${memoryContext}`
}

// High-priority safety system message layered ON TOP of the persona when a
// crisis disclosure is detected. It never replaces the persona — it only adds
// care + real-world resources, so a borderline false-positive keyword match
// degrades gracefully.
function crisisSafetyMessage(locale: string | undefined): string {
  if (locale?.startsWith('tr')) {
    return [
      'GÜVENLİK UYARISI: Kullanıcı kendine zarar verme veya intihar düşüncesi ifade ediyor olabilir.',
      'Bu mesaja en yüksek öncelikle, sıcak ve yargılamadan yaklaş.',
      'Yapman gerekenler: duygularını ciddiye al ve onayla; yalnız olmadığını hissettir;',
      'bunun gerçekten zor bir an olduğunu kabul et; acil bir tehlike varsa hemen 112 Acil',
      "Servisi'ni aramasını, güvendiği birine ulaşmasını ve bir ruh sağlığı uzmanından destek",
      "almasını nazikçe ama net biçimde öner. Bu durumda 'ben bir yapay zekayım' veya 'her zaman",
      "buradayım' gibi kalıpları KULLANMA; bunun yerine gerçek, insani destek kaynaklarına yönlendir.",
      'Asla yargılama, küçümseme ya da konuyu geçiştirme.',
    ].join(' ')
  }
  return [
    'SAFETY ALERT: The user may be expressing thoughts of self-harm or suicide.',
    'Treat this with the highest priority, with warmth and without judgment.',
    'You must: take their feelings seriously and validate them; help them feel they are not alone;',
    'acknowledge how hard this moment is; gently but clearly encourage them to contact emergency',
    'services immediately if they are in danger (call your local emergency number, e.g. 112 or 911),',
    'to reach out to someone they trust, and to seek support from a mental-health professional',
    '(a helpline can be found at findahelpline.com).',
    "In this situation do NOT use phrases like 'I am an AI' or 'I am always here'; instead point them",
    'to real human support. Never judge, minimize, or dismiss what they share.',
  ].join(' ')
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

async function callOpenAI(params: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  maxTokens: number
  temperature: number
  frequencyPenalty?: number
  presencePenalty?: number
  topP?: number
  model?: string
}) {
  const body: Record<string, unknown> = {
    model: params.model || MODEL,
    messages: params.messages,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
  }
  if (params.frequencyPenalty !== undefined) body.frequency_penalty = params.frequencyPenalty
  if (params.presencePenalty !== undefined) body.presence_penalty = params.presencePenalty
  if (params.topP !== undefined) body.top_p = params.topP

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error: ${res.status} ${text}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('OpenAI response missing content')
  }
  return content as string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!OPENAI_API_KEY) {
    console.error('Aiya function misconfigured: OPENAI_API_KEY missing')
    return jsonResponse({ error: 'OpenAI API key missing' }, 503)
  }

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    console.warn('Aiya function unauthorized: missing bearer token')
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Aiya function misconfigured: Supabase URL/anon key missing')
    return jsonResponse({ error: 'Supabase configuration missing' }, 500)
  }

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !userData?.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  if (!SERVICE_ROLE_KEY) {
    console.error('Aiya function misconfigured: service role key missing')
    return jsonResponse({ error: 'Service role key missing' }, 500)
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const userId = userData.user.id

  let usageUsed = 0
  let usageLimit = DEFAULT_LIMIT

  const { data: userRow, error: userRowError } = await supabaseAdmin
    .from('users')
    .select('aiya_messages_used, aiya_messages_limit')
    .eq('id', userId)
    .maybeSingle()

  if (userRowError) {
    console.error('Aiya function failed to load usage limits', userRowError)
    return jsonResponse({ error: 'Failed to load usage limits' }, 500)
  }

  if (!userRow) {
    const email = userData.user.email || 'unknown@local.invalid'
    const { error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          id: userId,
          email,
          is_premium: false,
          aiya_messages_used: 0,
          aiya_messages_limit: DEFAULT_LIMIT,
          weekly_summary_day: null,
          daily_reminder_time: null,
          language: 'tr',
          theme: 'light',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    if (upsertError) {
      console.error('Aiya function failed to create user row', upsertError)
      return jsonResponse({ error: 'Failed to create user' }, 500)
    }
  } else {
    usageUsed = userRow.aiya_messages_used ?? 0
    usageLimit = userRow.aiya_messages_limit ?? DEFAULT_LIMIT
  }

  let payload: AiyaRequest
  try {
    payload = (await req.json()) as AiyaRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400)
  }

  const { action, message, history = [], memoryContext, locale, systemPrompt, crisis } = payload
  const systemPromptHasPlaceholder = Boolean(systemPrompt?.includes('{{memories}}'))
  const system = normalizeSystemPrompt(systemPrompt, memoryContext)
  const langHint = locale?.startsWith('tr') ? 'Turkish' : 'English'

  // Normalize action once and dispatch EVERY branch on it, so stray casing
  // or whitespace cannot let e.g. a 'category' request fall through to the
  // billed free-form chat handler.
  const normalizedAction = String(action || '').toLowerCase().trim()
  const isCounted = COUNTED_ACTIONS.has(normalizedAction)

  // ── Server-side rate limiting + atomic metering ──────────────
  async function enforceRateLimit(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin.rpc('check_aiya_rate_limit', {
        p_user: userId,
        p_bucket: bucket,
        p_max: max,
        p_window_seconds: windowSeconds,
      })
      if (error) {
        // Fail-open on infra error so a missing/old RPC doesn't break Aiya.
        console.error('Aiya rate-limit RPC failed', error)
        return true
      }
      return data !== false
    } catch (err) {
      console.error('Aiya rate-limit RPC threw', err)
      return true
    }
  }

  // Atomically reserve one usage slot. Returns the new {used, limit}, or null
  // if the user is already at/over their cap.
  async function meterUsage(): Promise<{ used: number; limit: number } | null> {
    try {
      const { data, error } = await supabaseAdmin.rpc('increment_aiya_usage', { p_user: userId })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return null
      return { used: row.used ?? usageUsed + 1, limit: row.lim ?? usageLimit }
    } catch (err) {
      // Fallback for the (rare) case the RPC isn't deployed yet: non-atomic
      // read-then-write using the snapshot loaded above.
      console.error('Aiya increment_aiya_usage RPC unavailable, falling back', err)
      if (usageUsed >= usageLimit) return null
      const { data: updated } = await supabaseAdmin
        .from('users')
        .update({ aiya_messages_used: usageUsed + 1 })
        .eq('id', userId)
        .select('aiya_messages_used, aiya_messages_limit')
        .maybeSingle()
      return {
        used: updated?.aiya_messages_used ?? usageUsed + 1,
        limit: updated?.aiya_messages_limit ?? usageLimit,
      }
    }
  }

  // Best-effort refund if the OpenAI call fails AFTER we reserved a slot.
  async function refundUsage(): Promise<void> {
    try {
      await supabaseAdmin
        .from('users')
        .update({ aiya_messages_used: Math.max(0, usageUsed) })
        .eq('id', userId)
    } catch (err) {
      console.error('Aiya usage refund failed', err)
    }
  }

  // Apply the burst limiter up front.
  if (normalizedAction === 'classify' || normalizedAction === 'category') {
    if (!(await enforceRateLimit('classify', RATE_CLASSIFY_MAX, RATE_CLASSIFY_WINDOW_S))) {
      return jsonResponse({ error: 'Rate limit exceeded' }, 429)
    }
  } else if (isCounted || normalizedAction === 'profile') {
    // chat/analysis (billed) and the background profile build (not billed, but
    // an expensive gpt-4o call) all share the burst limiter.
    if (!(await enforceRateLimit('chat', RATE_CHAT_MAX, RATE_CHAT_WINDOW_S))) {
      return jsonResponse({ error: 'Rate limit exceeded' }, 429)
    }
  }

  // Validate required fields BEFORE reserving a usage slot, so a request the
  // server itself rejects (400) never charges the user.
  if (normalizedAction === 'chat' && !message) {
    return jsonResponse({ error: 'Message required' }, 400)
  }
  if (normalizedAction === 'analysis' && !memoryContext) {
    return jsonResponse({ error: 'No memories for analysis' }, 400)
  }

  // Reserve a usage slot for counted actions BEFORE spending on OpenAI.
  let metered = false
  let usage = { used: usageUsed, limit: usageLimit }
  if (isCounted) {
    const reserved = await meterUsage()
    if (!reserved) {
      return jsonResponse({ error: 'Usage limit exceeded' }, 429)
    }
    metered = true
    usage = reserved
  }

  try {
    if (normalizedAction === 'classify') {
      if (!message) return jsonResponse({ error: 'Message required' }, 400)

      // Extract keywords from message for better classification
      const lowerMessage = message.toLowerCase()
      const hasFunKeywords = /eğlence|eğlendim|eğlenceli|keyifli|zevk|fun|eğlen|güldüm|kahkaha|neşe/.test(lowerMessage)
      const hasWorkKeywords = /iş|work|arkadaş|colleague|ofis|office|proje|project|meslek|job|çalış|workplace/.test(lowerMessage)
      const hasSuccessKeywords = /başarı|success|kazandım|tamamladım|başardım|won|achieved|completed/.test(lowerMessage)

      const prompt = `Classify this memory. Return ONLY JSON: {"category":"<val>","lifeArea":"<val>"}

Categories: success(achievements,wins) | peace(calm,relaxation) | fun(joy,laughter,entertainment) | love(romance,affection) | gratitude(thankfulness) | inspiration(motivation,creative spark) | growth(learning,self-improvement) | adventure(exploration,travel,new experiences)

Life areas: personal(solo,self) | work(job,career,colleagues) | relationship(romantic partner) | family | friends | hobby(creative,leisure) | travel(trips) | health(fitness,wellness)

RULES:
- eğlence/eğlendim/keyifli/zevk → "fun"
- iş/arkadaş/work/colleague/ofis → lifeArea "work" not "personal"
- Only use "gratitude" if explicitly thankful
- Only use "personal" if no other area fits

Examples:
"iş arkadaşlarımla eğlendim" → {"category":"fun","lifeArea":"work"}
"İş yerinde projeyi tamamladım" → {"category":"success","lifeArea":"work"}
"Ailemle güzel akşam" → {"category":"fun","lifeArea":"family"}

Memory: "${message}"`

      const content = await callOpenAI({
        messages: [
          { role: 'system', content: `You are a strict JSON classifier. You MUST analyze the memory text and return ONLY valid JSON with category and lifeArea. Follow the examples exactly. Never default to gratitude/personal unless the text explicitly matches them.` },
          { role: 'user', content: prompt },
        ],
        maxTokens: 100,
        temperature: 0.05,
        model: MODEL_MINI,
      })

      const parsed = safeJsonParse(content)

      // Determine category. If the model gave us a valid one, use it.
      // Otherwise try to recover from the raw text, then keyword hints, then
      // fall back to null/'uncategorized' (NOT a hard 'gratitude' default —
      // the client treats null as "leave unset").
      let category: AllowedCategory | null = null
      let lifeArea: AllowedLifeArea | null = null

      if (parsed?.category && ALLOWED_CATEGORIES.includes(parsed.category as AllowedCategory)) {
        category = parsed.category as AllowedCategory
      } else {
        const responseLower = content.toLowerCase()
        for (const cat of ALLOWED_CATEGORIES) {
          if (responseLower.includes(`"category":"${cat}"`) || responseLower.includes(`category: "${cat}"`) || responseLower.includes(`'category': '${cat}'`)) {
            category = cat as AllowedCategory
            break
          }
        }
        if (!category) {
          if (hasFunKeywords) category = 'fun'
          else if (hasSuccessKeywords) category = 'success'
        }
      }

      if (parsed?.lifeArea && ALLOWED_LIFE_AREAS.includes(parsed.lifeArea as AllowedLifeArea)) {
        lifeArea = parsed.lifeArea as AllowedLifeArea
      } else {
        const responseLower = content.toLowerCase()
        for (const area of ALLOWED_LIFE_AREAS) {
          if (responseLower.includes(`"lifearea":"${area}"`) || responseLower.includes(`lifearea": "${area}"`) || responseLower.includes(`'lifearea': '${area}'`)) {
            lifeArea = area as AllowedLifeArea
            break
          }
        }
        if (!lifeArea && hasWorkKeywords) lifeArea = 'work'
      }

      return jsonResponse({
        category: category ?? 'uncategorized',
        lifeArea: lifeArea ?? 'uncategorized',
      })
    }

    if (normalizedAction === 'category') {
      if (!message) return jsonResponse({ error: 'Message required' }, 400)

      const prompt = `Classify into ONE category: success|peace|fun|love|gratitude|inspiration|growth|adventure. Reply with ONLY the category name. Do not default to gratitude. Memory: ${message}`

      const content = await callOpenAI({
        messages: [
          { role: 'system', content: `You are a precise memory classifier. Analyze the memory content carefully and select the most appropriate category. Reply with only the category name, no explanation.` },
          { role: 'user', content: prompt },
        ],
        maxTokens: 20,
        temperature: 0.1,
        model: MODEL_MINI,
      })
      const normalized = content.trim().toLowerCase()
      // Return null/'uncategorized' on an unrecognized reply instead of
      // silently defaulting to gratitude.
      const category = (ALLOWED_CATEGORIES.includes(normalized as AllowedCategory)
        ? normalized
        : 'uncategorized') as AllowedCategory | 'uncategorized'
      return jsonResponse({ category })
    }

    if (normalizedAction === 'analysis') {
      if (!memoryContext) return jsonResponse({ error: 'No memories for analysis' }, 400)
      const memoryBlock = systemPromptHasPlaceholder ? '' : `\n\nMemories:\n${memoryContext}`
      const prompt = `You are a deeply insightful emotional intelligence analyst with extraordinary perceptive abilities. Analyze this person's memories with depth no human could match. Look for:

1. EMOTIONAL TRENDS: What's the emotional arc of their life recently? Are they on an upswing or downswing? What emotions dominate? What's missing? Be specific with dates and patterns. Identify the EMOTIONAL TRAJECTORY — where are they heading? What chapter of their life are they in right now?

2. STANDOUT MEMORIES: Which memories are the most emotionally significant? Look at intensity scores, CORE flags, and the emotional weight of the text. Pick the ones that define who this person is. Identify TURNING POINTS — moments where the before and after are clearly different.

3. PATTERNS: What recurring themes do you see? Same people appearing? Same life areas? Same emotional states? What time-based patterns exist? What life areas are over/under-represented? Look for PARADOXES — do their memories contradict each other in interesting ways? Look for INVISIBLE CONNECTIONS between seemingly unrelated memories. Track RELATIONSHIP DYNAMICS — who's appearing more, who's fading?

4. RECOMMENDATIONS: Based on everything, what specific, actionable insights would genuinely help this person? Don't give generic advice. Reference their actual memories and patterns. What should they do more of? Less of? Who should they spend more time with? What life areas need attention? What personal GROWTH have they shown that they might not be aware of?

Return JSON with keys: emotionalTrends (string, 2-3 paragraphs), standoutMemories (array of strings with dates and context), patterns (string, 2-3 paragraphs), recommendations (string, specific and actionable).
Language: ${langHint}. Be warm, insightful, and genuinely helpful — speak like a wise friend, not a clinical analyst. Use their names and dates. Show them things about themselves they've never noticed.${memoryBlock}`
      const content = await callOpenAI({
        messages: [
          { role: 'system', content: system || `You are Aiya, a deeply perceptive emotional analyst. You see patterns others miss. Respond in ${langHint}.` },
          { role: 'user', content: prompt },
        ],
        maxTokens: 1200,
        temperature: 0.45,
        topP: 0.9,
      })
      const parsed = safeJsonParse(content)
      let analysis = parsed
      if (!analysis) {
        analysis = { emotionalTrends: content, standoutMemories: [], patterns: '', recommendations: '' }
      }

      return jsonResponse({ analysis, usage })
    }

    if (normalizedAction === 'profile') {
      const trimmedHistory = history.slice(-30)
      if (!memoryContext && trimmedHistory.length === 0) {
        return jsonResponse({ error: 'No context for profile' }, 400)
      }
      const conversationBlock =
        trimmedHistory.length > 0
          ? `\n\nConversation (most recent last):\n${trimmedHistory
              .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
              .join('\n')}`
          : ''
      const prompt = `Build an extraordinarily detailed psychological profile of this user. This profile is your memory — it will be injected into every future conversation to make you feel like you truly KNOW this person. Write it as dense notes to yourself.

MUST INCLUDE (if evidence exists):

1. IDENTITY & PERSONALITY
   - Core traits (introvert/extrovert, optimist/realist, analytical/emotional)
   - How they express themselves (writing style, humor type, emotional openness)
   - What makes them unique as a person
   - Their paradoxes and contradictions (what they say vs what they do)

2. INNER CIRCLE (with specific names)
   - Romantic partner (name, relationship dynamics, how they talk about them)
   - Family members (names, relationships, dynamics)
   - Close friends (names, what they do together)
   - Colleagues/mentors (if mentioned)
   - RELATIONSHIP TRENDS: Who's appearing more? Who's fading? Any new people?

3. EMOTIONAL LANDSCAPE
   - What genuinely makes them happy (with memory references)
   - What causes stress/anxiety/sadness
   - How they handle difficult emotions
   - Their emotional growth trajectory
   - Recurring emotional patterns (e.g. always stressed on Mondays, happy on weekends)

4. VALUES & WORLDVIEW
   - What they care most deeply about
   - Their life philosophy (even if unstated — infer from patterns)
   - What motivates them
   - Gap between stated values and actual behavior (if any)

5. CURRENT CHAPTER & NARRATIVE ARC
   - What's happening in their life RIGHT NOW
   - Recent mood trajectory (improving? declining? stable?)
   - What they might be struggling with but not saying directly
   - What life chapter are they in? (new beginning, transition, peak, closing, quiet period)
   - KEY TURNING POINTS from their memory timeline

6. CONVERSATION PREFERENCES
   - Do they prefer deep or light conversations?
   - How much humor do they appreciate?
   - Are there sensitive topics to approach carefully?
   - Do they want advice or just to be heard?

7. COMMUNICATION STYLE
   - Message length preference (short/medium/long)
   - Formality level (casual slang vs measured tone)
   - Emoji usage patterns
   - How they express vulnerability (direct or indirect)

8. GROWTH & CHANGE MARKERS
   - How has this person changed over their memory timeline?
   - What personal growth is visible but they might not realize?
   - What patterns suggest upcoming changes or decisions?

RULES: Be SPECIFIC — use names, dates, exact references. NEVER invent facts. If unknown, skip. Write in dense paragraph format, not bullet points. Keep under 2500 characters.
Language: ${langHint}.` +
        (memoryContext ? `\n\nMemories:\n${memoryContext}` : '') +
        conversationBlock
      const content = await callOpenAI({
        messages: [
          { role: 'system', content: `You are building a psychological profile that will serve as persistent memory for an AI companion. Be extraordinarily perceptive — notice what's said AND what's not said. Write dense, insightful notes. Never invent facts. Respond in ${langHint}.` },
          { role: 'user', content: prompt },
        ],
        maxTokens: 1500,
        temperature: 0.4,
        topP: 0.92,
      })

      return jsonResponse({ profile: content, usage })
    }

    if (normalizedAction === 'chat') {
      if (!message) return jsonResponse({ error: 'Message required' }, 400)
      const messages = [
        ...(crisis === true ? [{ role: 'system' as const, content: crisisSafetyMessage(locale) }] : []),
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user' as const, content: message },
      ]
      const reply = await callOpenAI({
        messages,
        maxTokens: CHAT_MAX_TOKENS,
        temperature: CHAT_TEMPERATURE,
        frequencyPenalty: CHAT_FREQUENCY_PENALTY,
        presencePenalty: CHAT_PRESENCE_PENALTY,
        topP: CHAT_TOP_P,
      })

      return jsonResponse({ reply, usage })
    }

    // Unknown action — do NOT silently bill it as a chat.
    return jsonResponse({ error: `Unknown action: ${normalizedAction || '(empty)'}` }, 400)
  } catch (error) {
    console.error('Aiya function error', error)
    // We reserved a usage slot before calling OpenAI — refund it on failure.
    if (metered) await refundUsage()
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500
    )
  }
})
