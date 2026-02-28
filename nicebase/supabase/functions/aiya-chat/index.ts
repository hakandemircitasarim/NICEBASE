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
const DEFAULT_LIMIT = 50
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

  console.log('Edge function called with action:', action, 'type:', typeof action, 'message:', message?.substring(0, 50))
  console.log('Full payload:', JSON.stringify({ action, hasMessage: !!message, messageLength: message?.length }))
  
  // Normalize action to string for comparison
  const normalizedAction = String(action || '').toLowerCase().trim()
  console.log('Normalized action:', normalizedAction)

  try {
    // New unified classify action: returns both category AND lifeArea
    // Check this FIRST before other actions - use normalized comparison
    if (normalizedAction === 'classify') {
      console.log('✅ CLASSIFY ACTION MATCHED!')
      console.log('Classify action called with message:', message?.substring(0, 100))
      if (!message) return jsonResponse({ error: 'Message required' }, 400)
      
      // Build category descriptions
      const categoryDescriptions = {
        success: 'Achievements, accomplishments, goals reached, victories, milestones, winning, completing something meaningful',
        peace: 'Calm moments, tranquility, serenity, relaxation, inner peace, quiet contentment, stress relief, mindfulness',
        fun: 'Joyful moments, laughter, entertainment, playfulness, humor, having a good time, lighthearted experiences',
        love: 'Romantic moments, deep affection, caring for someone, emotional connections, expressions of love, heartwarming experiences',
        gratitude: 'Thankfulness, appreciation, recognizing blessings, being grateful for something or someone, feeling blessed',
        inspiration: 'Motivational moments, being inspired, creative sparks, uplifting experiences, finding motivation, feeling energized',
        growth: 'Learning experiences, personal development, overcoming challenges, self-improvement, gaining wisdom, maturing',
        adventure: 'Exciting experiences, trying new things, exploration, travel, taking risks, novel experiences, stepping out of comfort zone'
      }
      
      // Build life area descriptions
      const lifeAreaDescriptions = {
        personal: 'Individual experiences, self-reflection, personal thoughts, solo activities, self-care, personal development',
        work: 'Job-related, career, professional achievements, workplace, business, professional relationships, work projects',
        relationship: 'Romantic partner, dating, significant other, intimate relationships, couple activities',
        family: 'Family members, parents, siblings, children, family gatherings, family traditions, family relationships',
        friends: 'Friendships, social activities with friends, friend groups, peer relationships, social connections',
        hobby: 'Hobbies, creative pursuits, leisure activities, interests, pastimes, recreational activities',
        travel: 'Trips, vacations, visiting places, exploring locations, travel experiences, tourism, journeys',
        health: 'Physical health, mental health, fitness, wellness, medical, exercise, self-care related to health'
      }
      
      const categoryList = ALLOWED_CATEGORIES.map(cat => `- ${cat}: ${categoryDescriptions[cat as keyof typeof categoryDescriptions]}`).join('\n')
      const lifeAreaList = ALLOWED_LIFE_AREAS.map(area => `- ${area}: ${lifeAreaDescriptions[area as keyof typeof lifeAreaDescriptions]}`).join('\n')
      
      // Extract keywords from message for better classification
      const lowerMessage = message.toLowerCase()
      const hasFunKeywords = /eğlence|eğlendim|eğlenceli|keyifli|zevk|fun|eğlen|güldüm|kahkaha|neşe/.test(lowerMessage)
      const hasWorkKeywords = /iş|work|arkadaş|colleague|ofis|office|proje|project|meslek|job|çalış|workplace/.test(lowerMessage)
      const hasSuccessKeywords = /başarı|success|kazandım|tamamladım|başardım|won|achieved|completed/.test(lowerMessage)
      const hasGratitudeKeywords = /şükür|gratitude|minnettar|teşekkür|thankful|blessed|şükret/.test(lowerMessage)
      
      const prompt = `Classify this memory into ONE category and ONE life area. Be precise and match the ACTUAL content.

CRITICAL: If the text contains words like "eğlence", "eğlendim", "eğlenceli", "keyifli", "zevk" → you MUST use category "fun"
CRITICAL: If the text mentions "iş", "arkadaş", "work", "colleague", "ofis" → you MUST use lifeArea "work" (not "personal")
CRITICAL: Do NOT use "gratitude" unless the text explicitly mentions being thankful or grateful
CRITICAL: Do NOT use "personal" for work-related memories - use "work" instead

CATEGORIES:
${categoryList}

LIFE AREAS:
${lifeAreaList}

EXAMPLES (follow these EXACTLY):
- "bugün iş arkadaşlarımla çok eğlendim" → {"category":"fun","lifeArea":"work"}
- "bu eğlendiğim bir anı örneğidir ve iş ile ilgilidir" → {"category":"fun","lifeArea":"work"}
- "Bu bir eğlence anısıdır" → {"category":"fun","lifeArea":"personal"}
- "anı eğlence zart zurt" → {"category":"fun","lifeArea":"personal"}
- "bugün çok sıkıntılı bir gündü ama yapay zeka ile yaptıklarım beni mutlu etti" → {"category":"fun","lifeArea":"personal"}
- "İş yerinde büyük bir projeyi tamamladım" → {"category":"success","lifeArea":"work"}
- "Ailemle güzel bir akşam geçirdik" → {"category":"fun","lifeArea":"family"}
- "Bugün neye şükrettim" → {"category":"gratitude","lifeArea":"personal"}

Memory to classify: "${message}"

Reply with ONLY valid JSON, no other text: {"category":"<value>","lifeArea":"<value>"}`
      
      const content = await callOpenAI({
        messages: [
          { role: 'system', content: `You are a strict JSON classifier. You MUST analyze the memory text and return ONLY valid JSON with category and lifeArea. Follow the examples exactly. Never default to gratitude/personal unless the text explicitly matches them.` },
          { role: 'user', content: prompt },
        ],
        maxTokens: 100,
        temperature: 0.05,
      })
      
      // Log for debugging (remove in production if needed)
      console.log('AI Response:', content)
      
      const parsed = safeJsonParse(content)
      
      // Better fallback logic - try to extract from response even if JSON is malformed
      let category: AllowedCategory = 'gratitude'
      let lifeArea: AllowedLifeArea = 'personal'
      
      if (parsed?.category && ALLOWED_CATEGORIES.includes(parsed.category as AllowedCategory)) {
        category = parsed.category as AllowedCategory
      } else {
        // Try to find category in response text
        const responseLower = content.toLowerCase()
        for (const cat of ALLOWED_CATEGORIES) {
          if (responseLower.includes(`"category":"${cat}"`) || responseLower.includes(`category: "${cat}"`) || responseLower.includes(`'category': '${cat}'`)) {
            category = cat as AllowedCategory
            break
          }
        }
        // Keyword-based fallback
        if (hasFunKeywords && category === 'gratitude') category = 'fun'
        if (hasSuccessKeywords && category === 'gratitude') category = 'success'
      }
      
      if (parsed?.lifeArea && ALLOWED_LIFE_AREAS.includes(parsed.lifeArea as AllowedLifeArea)) {
        lifeArea = parsed.lifeArea as AllowedLifeArea
      } else {
        // Try to find lifeArea in response text
        const responseLower = content.toLowerCase()
        for (const area of ALLOWED_LIFE_AREAS) {
          if (responseLower.includes(`"lifearea":"${area}"`) || responseLower.includes(`lifeArea": "${area}"`) || responseLower.includes(`'lifeArea': '${area}'`)) {
            lifeArea = area as AllowedLifeArea
            break
          }
        }
        // Keyword-based fallback
        if (hasWorkKeywords && lifeArea === 'personal') lifeArea = 'work'
      }
      
      console.log('Final classification:', { category, lifeArea, original: content })
      
      return jsonResponse({ category, lifeArea })
    }

    if (action === 'category') {
      if (!message) return jsonResponse({ error: 'Message required' }, 400)
      
      const categoryDescriptions = {
        success: 'Achievements, accomplishments, goals reached, victories, milestones',
        peace: 'Calm moments, tranquility, serenity, relaxation, inner peace',
        fun: 'Joyful moments, laughter, entertainment, playfulness, having a good time',
        love: 'Romantic moments, deep affection, caring for someone, emotional connections',
        gratitude: 'Thankfulness, appreciation, recognizing blessings, being grateful',
        inspiration: 'Motivational moments, being inspired, creative sparks, uplifting experiences',
        growth: 'Learning experiences, personal development, overcoming challenges, self-improvement',
        adventure: 'Exciting experiences, trying new things, exploration, travel, novel experiences'
      }
      
      const categoryList = ALLOWED_CATEGORIES.map(cat => `- ${cat}: ${categoryDescriptions[cat as keyof typeof categoryDescriptions]}`).join('\n')
      
      const prompt = `Analyze the following memory and classify it into the most appropriate category.

CATEGORIES:
${categoryList}

Carefully read the memory content and select the category that BEST matches the memory's actual emotional theme. Do not default to "gratitude" unless it truly fits.

Reply with ONLY the category name (one word, lowercase).

Memory: ${message}`
      
      const content = await callOpenAI({
        messages: [
          { role: 'system', content: `You are a precise memory classifier. Analyze the memory content carefully and select the most appropriate category. Reply with only the category name, no explanation.` },
          { role: 'user', content: prompt },
        ],
        maxTokens: 20,
        temperature: 0.1,
      })
      const normalized = content.trim().toLowerCase()
      const category = (ALLOWED_CATEGORIES.includes(normalized as AllowedCategory)
        ? normalized
        : 'gratitude') as AllowedCategory
      return jsonResponse({ category })
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

