import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, TrendingUp, Heart, AlertCircle, Loader2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { aiyaService } from '../services/aiyaService'
import { Memory } from '../types'
import LoadingSpinner from '../components/LoadingSpinner'
import { useUserId } from '../hooks/useUserId'
import { useMemories } from '../hooks/useMemories'
import { useNotifications } from '../hooks/useNotifications'
import { useNavigate } from 'react-router-dom'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AnalysisResult {
  emotionalTrends: string
  standoutMemories: string[]
  patterns: string
  recommendations: string
}

export default function Aiya() {
  const { t, i18n } = useTranslation()
  const { user } = useStore()
  const userId = useUserId()
  const navigate = useNavigate()
  const { memories, loading: loadingMemories } = useMemories(userId)
  const { showError, hapticFeedback } = useNotifications()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new message arrives
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || !user) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)
    hapticFeedback('light')

    try {
      const response = await aiyaService.chat(userId, userMessage.content, memories)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
      hapticFeedback('success')
    } catch (error) {
      showError(t('aiyaError'))
      hapticFeedback('error')
    } finally {
      setIsLoading(false)
    }
  }, [inputMessage, isLoading, user, userId, memories, hapticFeedback, showError, t])

  const handleAnalyze = useCallback(async () => {
    if (memories.length === 0) {
      showError(t('aiyaNoMemories'))
      return
    }

    setAnalyzing(true)
    setShowAnalysis(true)
    hapticFeedback('light')

    try {
      const result = await aiyaService.analyzeMemories(userId, memories)
      setAnalysisResult(result)
      hapticFeedback('success')
    } catch (error) {
      showError(t('aiyaAnalysisError'))
      hapticFeedback('error')
    } finally {
      setAnalyzing(false)
    }
  }, [memories, userId, hapticFeedback, showError, t])

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  // Check if OpenAI is available (not a hook, just a helper function)
  const isOpenAIAvailable = () => {
    const apiKey = (import.meta as any).env.VITE_OPENAI_API_KEY || ''
    return !!apiKey
  }

  // Early return for loading state - all hooks are called above
  if (loadingMemories) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="max-w-4xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 flex flex-col min-h-[calc(100dvh-8rem)] sm:min-h-[calc(100dvh-10rem)]"
    >

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg flex-shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {t('aiyaTitle') || 'Aiya - AI Asistanınız'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                {t('aiyaEmptyState') || 'Merhaba! Ben Aiya, duygusal destek asistanınız.'}
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAnalyze}
            disabled={analyzing || memories.length === 0 || !user}
            className="px-3 py-2 sm:px-4 sm:py-2 bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 text-primary rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[44px] min-h-[44px] touch-manipulation"
          >
            {analyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <TrendingUp className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t('aiyaAnalyze') || 'Analiz Et'}</span>
          </motion.button>
        </div>

        {/* Login Required Warning */}
        {!user && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start sm:items-center gap-2 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4"
          >
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                {t('aiyaLoginRequired') || 'Aiya\'ya erişmek için giriş yapmanız gerekiyor. Ayarlar sayfasından giriş yapabilirsiniz.'}
              </p>
              <div className="mt-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    hapticFeedback('light')
                    navigate('/settings?section=account')
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors touch-manipulation min-h-[44px]"
                  aria-label={t('aiyaLoginCta')}
                >
                  {t('aiyaLoginCta')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* OpenAI Warning */}
        {!isOpenAIAvailable() && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start sm:items-center gap-2 p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4"
          >
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200 leading-relaxed">
              {t('aiyaNoOpenAI') || 'OpenAI servisi şu anda kullanılamıyor.'}
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* Analysis Section */}
      <AnimatePresence>
        {showAnalysis && analysisResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl p-4 sm:p-6 border border-primary/20"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              {t('aiyaAnalysis') || 'Anı Analizi'}
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {t('aiyaEmotionalTrends') || 'Duygusal Trendler'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {analysisResult.emotionalTrends}
                </p>
              </div>
              {analysisResult.standoutMemories.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                    {t('aiyaStandoutMemories') || 'Öne Çıkan Anılar'}
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {analysisResult.standoutMemories.map((memory, idx) => (
                      <li key={idx}>{memory}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {t('aiyaPatterns') || 'Kalıplar'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {analysisResult.patterns}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {t('aiyaRecommendations') || 'Öneriler'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {analysisResult.recommendations}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 min-h-0">
        {messages.length === 0 && !showAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center py-12"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg px-4">
              {t('aiyaEmptyState') || 'Merhaba! Ben Aiya, duygusal destek asistanınız. Size nasıl yardımcı olabilirim?'}
            </p>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[85%] md:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                }`}
              >
                <p className="text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                <p
                  className={`text-xs mt-1.5 sm:mt-1 ${
                    message.role === 'user'
                      ? 'text-white/70'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('aiyaLoading') || 'Aiya düşünüyor...'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2 sm:gap-3 items-center bg-white dark:bg-gray-800 rounded-2xl p-2 sm:p-3 border border-gray-200 dark:border-gray-700 shadow-lg safe-area-bottom"
      >
        <textarea
          ref={inputRef}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('aiyaPlaceholder') || 'Aiya\'ya bir şey sorun...'}
          disabled={isLoading || !isOpenAIAvailable() || !user}
          className="flex-1 resize-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none text-sm sm:text-base leading-relaxed max-h-32 overflow-y-auto py-3 px-2"
          rows={1}
          style={{
            minHeight: '44px',
            maxHeight: '128px',
          }}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isLoading || !isOpenAIAvailable() || !user}
          className="w-12 h-12 sm:w-14 sm:h-14 min-w-[44px] min-h-[44px] bg-primary hover:bg-primary/90 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors shadow-md touch-manipulation"
          aria-label={t('aiyaSend') || 'Gönder'}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
          ) : (
            <Send className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </motion.button>
      </motion.div>
    </div>
  )
}
