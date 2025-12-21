import { Component, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import i18n from '../i18n'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console only in development
    if (import.meta.env.DEV) {
      console.error('Route Error Boundary caught an error:', error?.message || 'Unknown error', JSON.stringify({
        error: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack
      }, null, 2))
    }
    this.props.onError?.(error, errorInfo)
  }

  private safeTranslate = (key: string, fallback: string): string => {
    try {
      if (i18n && typeof i18n.t === 'function') {
        const translated = i18n.t(key)
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
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onReset={() => this.setState({ hasError: false, error: null })}
          safeTranslate={this.safeTranslate}
        />
      )
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  error: Error | null
  onReset: () => void
  safeTranslate: (key: string, fallback: string) => string
}

function ErrorFallback({ error, onReset, safeTranslate }: ErrorFallbackProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

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
            {safeTranslate('errorOccurredTitle', 'An Error Occurred')}
          </h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {safeTranslate('errorOccurredMessage', 'Sorry, an unexpected error occurred on this page.')}
        </p>
        {error && (
          <details className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 mb-2">
              {safeTranslate('errorDetails', 'Error Details')}
            </summary>
            <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded overflow-auto max-h-32">
              {error.message}
            </pre>
          </details>
        )}
        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
            aria-label={safeTranslate('retry', 'Retry')}
          >
            <RefreshCw size={18} />
            <span>{safeTranslate('retry', 'Retry')}</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 px-4 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            aria-label={safeTranslate('goHome', 'Go Home')}
          >
            <Home size={18} />
            <span>{safeTranslate('goHome', 'Go Home')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}








