import { supabase } from '../lib/supabase'
import { DailyQuestion, DailyQuestionAnswer } from '../types'
import i18n from '../i18n'

// Fallback questions (used when Supabase is unavailable or no question exists for today)
const FALLBACK_QUESTIONS_TR = [
  'Bugün neye şükrettin?',
  'Bu hafta seni en çok ne güldürdü?',
  'Son zamanlarda hangi başarını kutlamak istersin?',
  'Bugün seni mutlu eden küçük bir şey neydi?',
  'Hayatında kime teşekkür etmek istersin?',
  'Son zamanlarda öğrendiğin yeni bir şey neydi?',
  'Kendini en huzurlu hissettiğin an hangisiydi?',
  'Bugün birini nasıl mutlu ettin?',
  'En sevdiğin çocukluk anın hangisi?',
  'Hayatındaki en değerli ilişki hangisi?',
]

const FALLBACK_QUESTIONS_EN = [
  'What are you grateful for today?',
  'What made you laugh the most this week?',
  'What recent achievement would you like to celebrate?',
  'What small thing made you happy today?',
  'Who in your life would you like to thank?',
  'What is something new you learned recently?',
  'When was the last time you felt truly at peace?',
  'How did you make someone happy today?',
  'What is your favorite childhood memory?',
  'What is the most valuable relationship in your life?',
]

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

function getFallbackQuestion(): { questionTr: string; questionEn: string } {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  )
  const idx = dayOfYear % FALLBACK_QUESTIONS_TR.length
  return {
    questionTr: FALLBACK_QUESTIONS_TR[idx],
    questionEn: FALLBACK_QUESTIONS_EN[idx],
  }
}

/**
 * Synchronous default question — always available, no async needed.
 * Used to initialise state so the daily-question is never null.
 */
export function getDefaultQuestion(): DailyQuestion {
  const today = getTodayString()
  const fallback = getFallbackQuestion()
  return {
    id: `fallback-${today}`,
    questionTr: fallback.questionTr,
    questionEn: fallback.questionEn,
    date: today,
    createdAt: new Date().toISOString(),
  }
}

export const dailyQuestionService = {
  /**
   * Get today's daily question.
   * Returns cached question if available for today, otherwise fetches from
   * Supabase and falls back to local deterministic selection.
   */
  async getTodaysQuestion(): Promise<DailyQuestion> {
    const today = getTodayString()

    // Check localStorage cache first — prevents question changing on refresh
    try {
      const cached = localStorage.getItem('daily_question_cache')
      if (cached) {
        const parsed = JSON.parse(cached) as DailyQuestion
        if (parsed.date === today && parsed.id && parsed.questionTr) {
          return parsed
        }
      }
    } catch { /* ignore cache errors */ }

    let question: DailyQuestion | null = null

    try {
      const { data, error } = await supabase
        .from('daily_questions')
        .select('id, question_tr, question_en, date, created_at')
        .eq('date', today)
        .maybeSingle()

      if (!error && data) {
        question = {
          id: data.id,
          questionTr: data.question_tr,
          questionEn: data.question_en,
          date: data.date,
          createdAt: data.created_at,
        }
      }
    } catch {
      // Fall through to fallback
    }

    if (!question) {
      // Fallback: generate a deterministic question from local array
      const fallback = getFallbackQuestion()
      question = {
        id: `fallback-${today}`,
        questionTr: fallback.questionTr,
        questionEn: fallback.questionEn,
        date: today,
        createdAt: new Date().toISOString(),
      }
    }

    // Cache for the day
    try {
      localStorage.setItem('daily_question_cache', JSON.stringify(question))
    } catch { /* ignore */ }

    return question
  },

  /**
   * Get the localized question text based on current language
   */
  getLocalizedQuestion(question: DailyQuestion): string {
    return i18n.language?.startsWith('tr') ? question.questionTr : question.questionEn
  },

  /**
   * Save a user's answer to a daily question.
   */
  async saveAnswer(params: {
    userId: string
    questionId: string
    answerText: string
    memoryId?: string
  }): Promise<DailyQuestionAnswer | null> {
    const { userId, questionId, answerText, memoryId } = params

    // Don't try to save answers for fallback questions (no real DB row)
    if (questionId.startsWith('fallback-')) {
      return null
    }
    // Skip cloud operations for local/offline users
    if (userId.startsWith('local')) {
      return null
    }

    try {
      const { data, error } = await supabase
        .from('daily_question_answers')
        .insert({
          user_id: userId,
          question_id: questionId,
          answer_text: answerText,
          memory_id: memoryId || null,
          is_public: false,
        })
        .select()
        .single()

      if (error || !data) {
        return null
      }

      return {
        id: data.id,
        userId: data.user_id,
        questionId: data.question_id,
        answerText: data.answer_text,
        memoryId: data.memory_id,
        isPublic: data.is_public,
        createdAt: data.created_at,
      }
    } catch {
      return null
    }
  },

  /**
   * Check if user has already answered today's question
   */
  async hasAnsweredToday(userId: string, questionId: string): Promise<boolean> {
    if (questionId.startsWith('fallback-')) return false
    // Skip cloud query for local/offline users — RLS would reject them
    if (userId.startsWith('local')) return false

    try {
      const { count, error } = await supabase
        .from('daily_question_answers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('question_id', questionId)

      if (error) return false
      return (count ?? 0) > 0
    } catch {
      return false
    }
  },
}
