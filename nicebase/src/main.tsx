import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registerServiceWorker } from './utils/registerSW'
import './i18n'
import './index.css'

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const { protocol, hostname, host, pathname, search, hash } = window.location
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'
  if (protocol === 'https:' && isLocalHost) {
    window.location.replace(`http://${host}${pathname}${search}${hash}`)
  }
}

const container = document.getElementById('app')

if (!container) {
  throw new Error('App container not found')
}

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)

registerServiceWorker()
