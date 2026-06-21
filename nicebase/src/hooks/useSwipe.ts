import { useRef, useState, TouchEvent } from 'react'

interface SwipeHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

export function useSwipe(handlers: SwipeHandlers) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const touchEnd = useRef<{ x: number; y: number } | null>(null)

  const minSwipeDistance = 50

  const onTouchStart = (e: TouchEvent) => {
    touchEnd.current = null
    // Ignore multi-finger gestures (e.g. pinch-zoom) — they are not swipes.
    if (e.touches.length > 1) {
      touchStart.current = null
      return
    }
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    // A second finger landed mid-gesture (pinch): cancel any pending swipe so
    // releasing the pinch can't be read as a left/right swipe.
    if (e.touches.length > 1) {
      touchStart.current = null
      touchEnd.current = null
      return
    }
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    }
  }

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return

    const distanceX = touchStart.current.x - touchEnd.current.x
    const distanceY = touchStart.current.y - touchEnd.current.y
    const isLeftSwipe = distanceX > minSwipeDistance
    const isRightSwipe = distanceX < -minSwipeDistance
    const isUpSwipe = distanceY > minSwipeDistance
    const isDownSwipe = distanceY < -minSwipeDistance

    if (isLeftSwipe && handlers.onSwipeLeft) {
      handlers.onSwipeLeft()
    }
    if (isRightSwipe && handlers.onSwipeRight) {
      handlers.onSwipeRight()
    }
    if (isUpSwipe && handlers.onSwipeUp) {
      handlers.onSwipeUp()
    }
    if (isDownSwipe && handlers.onSwipeDown) {
      handlers.onSwipeDown()
    }
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}













