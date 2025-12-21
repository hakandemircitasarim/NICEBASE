import OpenAI from 'openai'
import { Memory } from '../types'
import { memoryService } from './memoryService'
import { errorLoggingService } from './errorLoggingService'
import i18n from '../i18n'

const apiKey = (import.meta as any).env.VITE_OPENAI_API_KEY || ''

// Only create OpenAI client if API key is available
const openai = apiKey ? new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true,
}) : null

// Check if OpenAI is available
const isOpenAIAvailable = () => {
  return !!apiKey && !!openai
}

const SUGGEST_COOLDOWN_KEY = 'nicebase_aiya_suggest_cooldown_until'
const CHAT_COOLDOWN_KEY = 'nicebase_aiya_chat_cooldown_until'

function readCooldown(key: string): number {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeCooldown(key: string, until: number) {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, String(until))
  } catch {
    // ignore
  }
}

let suggestionCooldownUntil = readCooldown(SUGGEST_COOLDOWN_KEY)
let chatCooldownUntil = readCooldown(CHAT_COOLDOWN_KEY)
let suggestInFlight = false
let chatInFlight = false

function isRateLimitError(err: any): boolean {
  const status = err?.status || err?.response?.status || err?.error?.status
  if (status === 429) return true
  const msg = String(err?.message || err?.error?.message || err || '')
  if (msg.includes('429') || msg.toLowerCase().includes('too many requests')) return true
  const code = String(err?.code || err?.error?.code || '')
  if (code === 'rate_limit_exceeded') return true
  return false
}

function setSuggestCooldown(ms: number) {
  suggestionCooldownUntil = Date.now() + ms
  writeCooldown(SUGGEST_COOLDOWN_KEY, suggestionCooldownUntil)
}

function setChatCooldown(ms: number) {
  chatCooldownUntil = Date.now() + ms
  writeCooldown(CHAT_COOLDOWN_KEY, chatCooldownUntil)
}

export const aiyaService = {
  canSuggestCategory(): boolean {
    return isOpenAIAvailable() && Date.now() >= suggestionCooldownUntil
  },

  async chat(userId: string, message: string, memories: Memory[]): Promise<string> {
    if (!isOpenAIAvailable()) {
      return i18n.t('openAIServiceUnavailable')
    }
    if (Date.now() < chatCooldownUntil) {
      return i18n.t('openAIServiceUnavailable')
    }
    if (chatInFlight) {
      return i18n.t('openAIServiceUnavailable')
    }

    const memoriesText = memories.slice(0, 50).map(m => `- ${m.text} (${m.category}, ${m.intensity}/10, ${m.date})`).join('\n')
    const systemPrompt = i18n.t('aiyaSystemPrompt', { memories: memoriesText })

    try {
      chatInFlight = true
      const completion = await openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      })

      return completion.choices[0]?.message?.content || i18n.t('sorryErrorOccurred')
    } catch (error) {
      if (isRateLimitError(error)) {
        setChatCooldown(5 * 60 * 1000)
        return i18n.t('openAIServiceUnavailable')
      }
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Aiya chat error'),
        'error',
        userId
      )
      return i18n.t('connectionIssue')
    } finally {
      chatInFlight = false
    }
  },

  async suggestCategory(text: string): Promise<string | null> {
    if (!text || text.length < 10) return null
    if (!isOpenAIAvailable()) return null
    if (Date.now() < suggestionCooldownUntil) return null
    if (suggestInFlight) return null

    const prompt = i18n.t('categorySuggestionPrompt', { text })
    const systemPrompt = i18n.t('categorySuggestionSystemPrompt')

    try {
      suggestInFlight = true
      const completion = await openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 10,
      })

      const category = completion.choices[0]?.message?.content?.trim().toLowerCase()
      if (['success', 'peace', 'fun', 'love', 'gratitude', 'inspiration', 'growth', 'adventure'].includes(category || '')) {
        return category || null
      }
      return null
    } catch (error) {
      if (isRateLimitError(error)) {
        setSuggestCooldown(5 * 60 * 1000)
      }
      return null
    } finally {
      suggestInFlight = false
    }
  },

  async analyzeMemories(userId: string, memories: Memory[]): Promise<{
    emotionalTrends: string
    standoutMemories: string[]
    patterns: string
    recommendations: string
  }> {
    if (!isOpenAIAvailable()) {
      return {
        emotionalTrends: i18n.t('analysisUnavailable'),
        standoutMemories: [],
        patterns: i18n.t('analysisUnavailable'),
        recommendations: i18n.t('addMoreMemoriesForAnalysis'),
      }
    }

    // Format memories based on language
    const isTurkish = i18n.language === 'tr'
    const categoryLabel = isTurkish ? 'Kategori' : 'Category'
    const intensityLabel = isTurkish ? 'Yoğunluk' : 'Intensity'
    const dateLabel = isTurkish ? 'Tarih' : 'Date'
    const lifeAreaLabel = isTurkish ? 'Yaşam Alanı' : 'Life Area'
    
    const memoriesText = memories.map(m => 
      `${m.text} | ${categoryLabel}: ${m.category} | ${intensityLabel}: ${m.intensity}/10 | ${dateLabel}: ${m.date} | ${lifeAreaLabel}: ${m.lifeArea}`
    ).join('\n\n')

    const prompt = i18n.t('memoryAnalysisPrompt', { memories: memoriesText })
    const systemPrompt = i18n.t('memoryAnalysisSystemPrompt')

    try {
      const completion = await openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })

      const content = completion.choices[0]?.message?.content || '{}'
      return JSON.parse(content)
    } catch (error) {
      errorLoggingService.logError(
        error instanceof Error ? error : new Error('Memory analysis error'),
        'error',
        userId
      )
      return {
        emotionalTrends: i18n.t('analysisUnavailable'),
        standoutMemories: [],
        patterns: i18n.t('analysisUnavailable'),
        recommendations: i18n.t('addMoreMemoriesForAnalysis'),
      }
    }
  },
}

