import { useState, useRef, TouchEvent } from 'react'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  threshold?: number
  disabled?: boolean
}

export function usePullToRefresh({ onRefresh, threshold = 80, disabled = false }: UsePullToRefreshOptions) {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef<number | null>(null)

  const handleTouchStart = (e: TouchEvent) => {
    if (disabled || window.scrollY !== 0) return
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (disabled || touchStartY.current === null) return

    const touchY = e.touches[0].clientY
    const distance = touchY - touchStartY.current

    if (distance > 0 && window.scrollY === 0) {
      setIsPulling(true)
      const maxDistance = threshold * 1.5
      setPullDistance(Math.min(distance, maxDistance))
    } else if (distance <= 0) {
      setIsPulling(false)
      setPullDistance(0)
    }
  }

  const handleTouchEnd = async () => {
    if (disabled) return

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }
    
    // Reset after a short delay for smooth animation
    setTimeout(() => {
      setIsPulling(false)
      setPullDistance(0)
      touchStartY.current = null
    }, 300)
  }

  const progress = Math.min(pullDistance / threshold, 1)
  const canRelease = pullDistance >= threshold

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress: progress,
    canRelease,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}
