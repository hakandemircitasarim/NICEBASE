import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './i18n'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { errorLoggingService } from './services/errorLoggingService'

const rootElement = document.getElementById('app')

if (!rootElement) {
  if (import.meta.env.DEV) {
    console.error('[NICEBASE] ERROR: Root element not found!')
  }
  errorLoggingService.logError(
    new Error('Root element not found'),
    'error'
  )
  throw new Error('Root element not found')
}

try {
  const root = createRoot(rootElement)

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  )
} catch (error) {
  errorLoggingService.logError(
    error instanceof Error ? error : new Error('Fatal error during render'),
    'error'
  )
  // Show error on screen
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif;">
        <h1 style="color: red;">Fatal Error</h1>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">${error instanceof Error ? error.stack : String(error)}</pre>
      </div>
    `
  }
  throw error
}
