import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}))

// Mock i18n
vi.mock('../../i18n', () => ({
  default: { t: (key: string) => key, language: 'tr' },
}))

import { dailyQuestionService, getDefaultQuestion } from '../dailyQuestionService'

describe('getDefaultQuestion', () => {
  it('returns a fallback question for today', () => {
    const q = getDefaultQuestion()
    const today = new Date().toISOString().split('T')[0]
    expect(q.date).toBe(today)
    expect(q.id).toBe(`fallback-${today}`)
    expect(q.questionTr).toBeTruthy()
    expect(q.questionEn).toBeTruthy()
  })

  it('returns deterministic question for the same day', () => {
    const q1 = getDefaultQuestion()
    const q2 = getDefaultQuestion()
    expect(q1.questionTr).toBe(q2.questionTr)
    expect(q1.questionEn).toBe(q2.questionEn)
  })
})

describe('dailyQuestionService.getLocalizedQuestion', () => {
  it('returns Turkish question when language is tr', () => {
    const question = {
      id: 'test',
      questionTr: 'Türkçe soru',
      questionEn: 'English question',
      date: '2024-01-01',
      createdAt: '2024-01-01T00:00:00Z',
    }
    // i18n.language is mocked as 'tr'
    expect(dailyQuestionService.getLocalizedQuestion(question)).toBe('Türkçe soru')
  })
})

describe('dailyQuestionService.saveAnswer', () => {
  it('returns null for fallback questions', async () => {
    const result = await dailyQuestionService.saveAnswer({
      userId: 'user1',
      questionId: 'fallback-2024-01-01',
      answerText: 'My answer',
    })
    expect(result).toBeNull()
  })

  it('returns null for local users', async () => {
    const result = await dailyQuestionService.saveAnswer({
      userId: 'local_abc123',
      questionId: 'real-question-id',
      answerText: 'My answer',
    })
    expect(result).toBeNull()
  })
})

describe('dailyQuestionService.hasAnsweredToday', () => {
  it('returns false for fallback questions', async () => {
    const result = await dailyQuestionService.hasAnsweredToday('user1', 'fallback-2024-01-01')
    expect(result).toBe(false)
  })

  it('returns false for local users', async () => {
    const result = await dailyQuestionService.hasAnsweredToday('local_abc123', 'real-id')
    expect(result).toBe(false)
  })
})

describe('dailyQuestionService.getTodaysQuestion', () => {
  beforeEach(() => {
    // Clear localStorage cache
    localStorage.removeItem('daily_question_cache')
  })

  it('returns a question with today date', async () => {
    const question = await dailyQuestionService.getTodaysQuestion()
    const today = new Date().toISOString().split('T')[0]
    expect(question.date).toBe(today)
  })

  it('returns fallback when supabase returns no data', async () => {
    const question = await dailyQuestionService.getTodaysQuestion()
    expect(question.id).toMatch(/^fallback-/)
  })

  it('caches the question in localStorage', async () => {
    await dailyQuestionService.getTodaysQuestion()
    const cached = localStorage.getItem('daily_question_cache')
    expect(cached).toBeTruthy()
    const parsed = JSON.parse(cached!)
    expect(parsed.date).toBe(new Date().toISOString().split('T')[0])
  })

  it('uses cache on second call', async () => {
    const q1 = await dailyQuestionService.getTodaysQuestion()
    const q2 = await dailyQuestionService.getTodaysQuestion()
    expect(q1.questionTr).toBe(q2.questionTr)
  })
})
