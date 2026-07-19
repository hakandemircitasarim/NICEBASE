// Lightweight product-analytics service.
//
// Mirrors errorLoggingService: events are kept in a capped localStorage ring
// (always available for inspection / export / debugging) and, when the opt-in
// endpoint VITE_ANALYTICS_ENDPOINT is set, best-effort POSTed there (your own
// collector, a Supabase edge function, etc.). With no endpoint it stays purely
// local — no third-party SDK, no backend dependency, never throws.
export interface AnalyticsEvent {
  name: string
  props?: Record<string, string | number | boolean>
  timestamp: string
  userId?: string
}

class AnalyticsService {
  private events: AnalyticsEvent[] = []
  private readonly maxEvents = 300
  private readonly storageKey = 'analyticsEvents'

  constructor() {
    // Restore prior events so a page reload / resume keeps a continuous log.
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) this.events = parsed
      }
    } catch {
      /* localStorage unavailable / bad JSON — start empty */
    }
  }

  track(name: string, props?: AnalyticsEvent['props'], userId?: string) {
    const event: AnalyticsEvent = {
      name,
      props,
      timestamp: new Date().toISOString(),
      userId,
    }

    this.events.push(event)
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.events))
    } catch {
      /* localStorage full/disabled — keep in-memory only */
    }

    if (import.meta.env.DEV) {
      console.log('[analytics]', name, props ?? '')
    }

    this.send(event)
  }

  private async send(event: AnalyticsEvent) {
    // Opt-in remote transport. Unset → no-op (events remain local, exportable).
    const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT
    if (!endpoint) return
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true, // allow the request to outlive a page unload
      })
    } catch {
      // Non-critical — the event is already persisted locally.
    }
  }

  getEvents(): AnalyticsEvent[] {
    try {
      const stored = localStorage.getItem(this.storageKey)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  clearEvents() {
    this.events = []
    try {
      localStorage.removeItem(this.storageKey)
    } catch {
      /* ignore */
    }
  }

  exportEvents(): string {
    return JSON.stringify(this.events, null, 2)
  }
}

export const analyticsService = new AnalyticsService()
