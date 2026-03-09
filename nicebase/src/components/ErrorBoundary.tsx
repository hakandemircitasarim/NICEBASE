import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import i18n from '../i18n'
import { errorLoggingService } from '../services/errorLoggingService'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error service
    errorLoggingService.logError(
      new Error(`${error.message}\nComponent Stack: ${errorInfo.componentStack}`),
      'error'
    )
    
    // Also log to console in dev mode for debugging
    if (import.meta.env.DEV) {
      console.error('Uncaught error:', error?.message || 'Unknown error', JSON.stringify({
        error: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack
      }, null, 2))
    }
  }

  private safeTranslate = (key: string, fallback: string): string => {
    try {
      if (i18n && typeof i18n.t === 'function') {
        const translated = i18n.t(key)
        // If translation returns the key itself, it means translation failed
        return translated !== key ? translated : fallback
      }
    } catch (e) {
      // Translation error is non-critical
      if (import.meta.env.DEV) {
        console.warn('Translation error:', e)
      }
    }
    return fallback
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-500" size={24} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {this.safeTranslate('errorOccurredTitle', 'Bir Hata Oluştu')}
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {this.safeTranslate('errorOccurredMessage', 'Üzgünüm, beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin.')}
            </p>
            {this.state.error && (
              <pre className="mb-4 p-2 bg-gray-100 dark:bg-gray-900 rounded overflow-auto text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors touch-manipulation"
                aria-label={this.safeTranslate('refreshPage', 'Sayfayı Yenile')}
              >
                {this.safeTranslate('refreshPage', 'Sayfayı Yenile')}
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                aria-label={this.safeTranslate('tryAgain', 'Tekrar Dene')}
              >
                {this.safeTranslate('tryAgain', 'Tekrar Dene')}
              </button>
            </div>
          </motion.div>
        </div>
      )
    }

    return this.props.children
  }
}

