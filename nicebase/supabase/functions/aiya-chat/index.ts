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
const DEFAULT_LIMIT = 30
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
  countUsage?: boolean
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
}) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: params.messages,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    }),
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

  if (usageUsed >= usageLimit) {
    return jsonResponse({ error: 'Usage limit exceeded' }, 429)
  }

  let payload: AiyaRequest
  try {
    payload = (await req.json()) as AiyaRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400)
  }

  const { action, message, history = [], memoryContext, locale, systemPrompt, countUsage } = payload
  const systemPromptHasPlaceholder = Boolean(systemPrompt?.includes('{{memories}}'))
  const system = normalizeSystemPrompt(systemPrompt, memoryContext)
  const langHint = locale?.startsWith('tr') ? 'Turkish' : 'English'

  try {
    if (action === 'category') {
      if (!message) return jsonResponse({ error: 'Message required' }, 400)
      const prompt = `Classify the following memory into one of these categories: ${ALLOWED_CATEGORIES.join(
        ', '
      )}. Reply with only the category name.\n\nMemory: ${message}`
      const content = await callOpenAI({
        messages: [
          { role: 'system', content: `You are a classifier. Respond in ${langHint} if needed.` },
          { role: 'user', content: prompt },
        ],
        maxTokens: 20,
        temperature: 0.2,
      })
      const normalized = content.trim().toLowerCase()
      const category = (ALLOWED_CATEGORIES.includes(normalized as AllowedCategory)
        ? normalized
        : 'gratitude') as AllowedCategory
      return jsonResponse({ category })
    }

    // New unified classify action: returns both category AND lifeArea
    if (action === 'classify') {
      if (!message) return jsonResponse({ error: 'Message required' }, 400)
      const prompt = `Classify the following memory text.
Pick exactly one category from: ${ALLOWED_CATEGORIES.join(', ')}
Pick exactly one life area from: ${ALLOWED_LIFE_AREAS.join(', ')}
Reply ONLY with valid JSON: {"category":"<value>","lifeArea":"<value>"}

Memory: ${message}`
      const content = await callOpenAI({
        messages: [
          { role: 'system', content: `You are a strict JSON classifier. Always reply with valid JSON only. No extra text.` },
          { role: 'user', content: prompt },
        ],
        maxTokens: 60,
        temperature: 0.15,
      })
      const parsed = safeJsonParse(content)
      const category = (parsed?.category && ALLOWED_CATEGORIES.includes(parsed.category as AllowedCategory))
        ? parsed.category as AllowedCategory
        : 'gratitude'
      const lifeArea = (parsed?.lifeArea && ALLOWED_LIFE_AREAS.includes(parsed.lifeArea as AllowedLifeArea))
        ? parsed.lifeArea as AllowedLifeArea
        : 'personal'
      return jsonResponse({ category, lifeArea })
    }

    if (action === 'analysis') {
      if (!memoryContext) return jsonResponse({ error: 'No memories for analysis' }, 400)
      const memoryBlock = systemPromptHasPlaceholder ? '' : `\n\nMemories:\n${memoryContext}`
      const prompt = `Provide a concise analysis of the user's memories. Return JSON only with keys:
emotionalTrends (string), standoutMemories (array of short strings), patterns (string), recommendations (string).
Language: ${langHint}.${memoryBlock}`
      const content = await callOpenAI({
        messages: [
          { role: 'system', content: system || `You are Aiya. Respond in ${langHint}.` },
          { role: 'user', content: prompt },
        ],
        maxTokens: 600,
        temperature: 0.4,
      })
      const parsed = safeJsonParse(content)
      let analysis = parsed
      if (!analysis) {
        analysis = { emotionalTrends: content, standoutMemories: [], patterns: '', recommendations: '' }
      }

      if (countUsage !== false) {
        const { data: updated } = await supabaseAdmin
          .from('users')
          .update({ aiya_messages_used: usageUsed + 1 })
          .eq('id', userId)
          .select('aiya_messages_used, aiya_messages_limit')
          .maybeSingle()
        if (updated) {
          usageUsed = updated.aiya_messages_used ?? usageUsed + 1
          usageLimit = updated.aiya_messages_limit ?? usageLimit
        }
      }

      return jsonResponse({ analysis, usage: { used: usageUsed, limit: usageLimit } })
    }

    if (action === 'profile') {
      const trimmedHistory = history.slice(-20)
      if (!memoryContext && trimmedHistory.length === 0) {
        return jsonResponse({ error: 'No context for profile' }, 400)
      }
      const conversationBlock =
        trimmedHistory.length > 0
          ? `\n\nConversation (most recent last):\n${trimmedHistory
              .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
              .join('\n')}`
          : ''
      const prompt = `Summarize the user into a concise profile based on memories and conversation. Return plain text only with 6-8 bullet points.
If a detail is unknown, skip it. Do not invent personal facts. Keep it under 1200 characters.
Language: ${langHint}.` +
        (memoryContext ? `\n\nMemories:\n${memoryContext}` : '') +
        conversationBlock
      const content = await callOpenAI({
        messages: [
          { role: 'system', content: `You are Aiya. Be precise and safe. Respond in ${langHint}.` },
          { role: 'user', content: prompt },
        ],
        maxTokens: 500,
        temperature: 0.3,
      })

      if (countUsage !== false) {
        const { data: updated } = await supabaseAdmin
          .from('users')
          .update({ aiya_messages_used: usageUsed + 1 })
          .eq('id', userId)
          .select('aiya_messages_used, aiya_messages_limit')
          .maybeSingle()
        if (updated) {
          usageUsed = updated.aiya_messages_used ?? usageUsed + 1
          usageLimit = updated.aiya_messages_limit ?? usageLimit
        }
      }

      return jsonResponse({ profile: content, usage: { used: usageUsed, limit: usageLimit } })
    }

    if (!message) return jsonResponse({ error: 'Message required' }, 400)
    const messages = [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: message },
    ]
    const reply = await callOpenAI({
      messages,
      maxTokens: 800,
      temperature: 0.75,
    })

    if (countUsage !== false) {
      const { data: updated } = await supabaseAdmin
        .from('users')
        .update({ aiya_messages_used: usageUsed + 1 })
        .eq('id', userId)
        .select('aiya_messages_used, aiya_messages_limit')
        .maybeSingle()
      if (updated) {
        usageUsed = updated.aiya_messages_used ?? usageUsed + 1
        usageLimit = updated.aiya_messages_limit ?? usageLimit
      }
    }

    return jsonResponse({ reply, usage: { used: usageUsed, limit: usageLimit } })
  } catch (error) {
    console.error('Aiya function error', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      500
    )
  }
})

