import { useRef, useCallback } from 'react'

interface UseLongPressOptions {
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void
  delay?: number
  threshold?: number // Maximum distance to move before canceling long press
}

export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
  threshold = 10,
}: UseLongPressOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  const isLongPressRef = useRef(false)

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      isLongPressRef.current = false
      
      // Get initial position
      if ('touches' in e) {
        startPosRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        }
      } else {
        startPosRef.current = {
          x: e.clientX,
          y: e.clientY,
        }
      }

      timeoutRef.current = setTimeout(() => {
        isLongPressRef.current = true
        onLongPress(e)
      }, delay)
    },
    [onLongPress, delay]
  )

  const clear = useCallback(
    (e: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Check if moved too far
      if (startPosRef.current) {
        let currentX: number, currentY: number
        
        if ('touches' in e && e.touches.length > 0) {
          currentX = e.touches[0].clientX
          currentY = e.touches[0].clientY
        } else if ('changedTouches' in e && e.changedTouches.length > 0) {
          currentX = e.changedTouches[0].clientX
          currentY = e.changedTouches[0].clientY
        } else {
          currentX = (e as React.MouseEvent).clientX
          currentY = (e as React.MouseEvent).clientY
        }

        const distance = Math.sqrt(
          Math.pow(currentX - startPosRef.current.x, 2) +
          Math.pow(currentY - startPosRef.current.y, 2)
        )

        if (distance > threshold) {
          shouldTriggerClick = false
        }
      }

      if (shouldTriggerClick && !isLongPressRef.current && onClick) {
        onClick(e)
      }

      startPosRef.current = null
    },
    [onClick, threshold]
  )

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e, true),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchEnd: (e: React.TouchEvent) => clear(e, true),
    onTouchMove: (e: React.TouchEvent) => {
      // Cancel if moved too far
      if (startPosRef.current) {
        const currentX = e.touches[0].clientX
        const currentY = e.touches[0].clientY
        const distance = Math.sqrt(
          Math.pow(currentX - startPosRef.current.x, 2) +
          Math.pow(currentY - startPosRef.current.y, 2)
        )

        if (distance > threshold && timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          startPosRef.current = null
        }
      }
    },
  }
}








