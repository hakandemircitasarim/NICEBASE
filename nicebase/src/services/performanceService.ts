// Performance Monitoring Service
export interface PerformanceMetric {
  name: string
  value: number
  timestamp: string
  type: 'navigation' | 'resource' | 'measure' | 'paint'
}

class PerformanceService {
  private metrics: PerformanceMetric[] = []

  init() {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return
    }

    // Measure page load time and navigation timing after page loads
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.measurePageLoad()
        this.measureNavigationTiming()
        this.measureResourceTiming()
      }, 0)
    })
  }

  private measurePageLoad() {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    if (perfData && perfData.loadEventEnd > 0) {
      const metrics = {
        'dom-content-loaded': perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        'load-complete': perfData.loadEventEnd - perfData.loadEventStart,
        'first-byte': perfData.responseStart - perfData.requestStart,
        'dom-interactive': perfData.domInteractive - (perfData as any).navigationStart,
      }

      Object.entries(metrics).forEach(([name, value]) => {
        // Only record valid metrics (not NaN, not negative, not zero for timing metrics)
        if (!isNaN(value) && value >= 0) {
          this.recordMetric({
            name,
            value: Math.round(value),
            timestamp: new Date().toISOString(),
            type: 'navigation'
          })
        }
      })
    }
  }

  private measureNavigationTiming() {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    if (perfData && perfData.loadEventEnd > 0) {
      const loadTime = perfData.loadEventEnd - perfData.fetchStart
      // Only record valid metrics
      if (!isNaN(loadTime) && loadTime > 0) {
        this.recordMetric({
          name: 'page-load-time',
          value: Math.round(loadTime),
          timestamp: new Date().toISOString(),
          type: 'navigation'
        })
      }
    }
  }

  private measureResourceTiming() {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    
    resources.forEach((resource) => {
      if (resource.duration > 1000) { // Log slow resources (>1s)
        this.recordMetric({
          name: `resource-${resource.name.split('/').pop()}`,
          value: Math.round(resource.duration),
          timestamp: new Date().toISOString(),
          type: 'resource'
        })
      }
    })
  }

  recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric)

    // Keep only last 50 metrics
    if (this.metrics.length > 50) {
      this.metrics.shift()
    }

    // Log in development
    if (import.meta.env.DEV) {
      console.log('Performance metric:', metric)
    }
  }

  measureCustom(name: string, startMark: string, endMark: string) {
    try {
      performance.measure(name, startMark, endMark)
      const measure = performance.getEntriesByName(name)[0]
      
      if (measure) {
        this.recordMetric({
          name,
          value: Math.round(measure.duration),
          timestamp: new Date().toISOString(),
          type: 'measure'
        })
      }
    } catch (e) {
      // Performance measurement failed - non-critical
      if (import.meta.env.DEV) {
        console.warn('Could not measure performance:', e)
      }
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  clearMetrics() {
    this.metrics = []
  }
}

export const performanceService = new PerformanceService()











