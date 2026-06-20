// Error Logging Service
export interface ErrorLog {
  message: string
  stack?: string
  timestamp: string
  userAgent: string
  url: string
  userId?: string
  severity: 'error' | 'warning' | 'info'
}

class ErrorLoggingService {
  private logs: ErrorLog[] = []
  private maxLogs = 100

  logError(error: Error | string, severity: ErrorLog['severity'] = 'error', userId?: string) {
    const errorLog: ErrorLog = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' && error.stack ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: userId,
      severity,
    }

    this.logs.push(errorLog)

    // Keep only last maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('errorLogs', JSON.stringify(this.logs))
    } catch (e) {
      // localStorage might be disabled, fail silently
      if (import.meta.env.DEV) {
        console.warn('Could not save error logs to localStorage', e)
      }
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error logged:', JSON.stringify(errorLog, null, 2))
    }

    // In production, you can send to error tracking service
    if (import.meta.env.PROD) {
      this.sendToErrorService(errorLog)
    }
  }

  private async sendToErrorService(errorLog: ErrorLog) {
    // Remote transport is OPT-IN: set VITE_ERROR_LOGGING_ENDPOINT to a URL that
    // accepts a JSON POST of the error log (your own collector, a Supabase edge
    // function, a Sentry tunnel, etc.). When it's unset this is a no-op and
    // errors remain in localStorage (capped 100, exportable via exportLogs()).
    const endpoint = import.meta.env.VITE_ERROR_LOGGING_ENDPOINT
    if (!endpoint) return

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorLog),
        keepalive: true, // allow the request to outlive a page unload
      })
    } catch (e) {
      // Failed to send error to tracking service — non-critical.
      if (import.meta.env.DEV) {
        console.warn('Could not send error to tracking service', e)
      }
    }
  }

  getLogs(): ErrorLog[] {
    try {
      const stored = localStorage.getItem('errorLogs')
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      // Log parsing errors in development
      if (import.meta.env.DEV) {
        console.warn('Failed to parse error logs from localStorage:', error)
      }
      return []
    }
  }

  clearLogs() {
    this.logs = []
    localStorage.removeItem('errorLogs')
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

export const errorLoggingService = new ErrorLoggingService()

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorLoggingService.logError(
      new Error(event.message),
      'error',
      undefined
    )
  })

  window.addEventListener('unhandledrejection', (event) => {
    errorLoggingService.logError(
      new Error(event.reason?.toString() || 'Unhandled promise rejection'),
      'error',
      undefined
    )
  })
}





