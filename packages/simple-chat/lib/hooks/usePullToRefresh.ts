"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface UsePullToRefreshOptions {
  /** Callback when refresh is triggered */
  onRefresh: () => Promise<void> | void
  /** Minimum pull distance to trigger refresh (default: 80px) */
  threshold?: number
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean
}

interface UsePullToRefreshResult {
  /** Whether currently refreshing */
  isRefreshing: boolean
  /** Current pull distance (0 when not pulling) */
  pullDistance: number
  /** Progress towards threshold (0-1) */
  pullProgress: number
  /** Whether pull has reached threshold */
  isPulling: boolean
  /** Props to spread on the scrollable container */
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
  }
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  enabled = true,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)

  const startY = useRef(0)
  const containerRef = useRef<HTMLElement | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || isRefreshing) return

    const target = e.currentTarget as HTMLElement
    containerRef.current = target

    // Only enable pull-to-refresh when scrolled to top
    if (target.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      setIsPulling(true)
    }
  }, [enabled, isRefreshing])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || !enabled || isRefreshing) return

    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current

    // Only pull down
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      // Apply resistance (diminishing returns as you pull further)
      const resistance = 0.5
      const distance = diff * resistance
      setPullDistance(Math.min(distance, threshold * 1.5))

      // Prevent default scrolling when pulling
      if (diff > 10) {
        e.preventDefault()
      }
    }
  }, [isPulling, enabled, isRefreshing, threshold])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return

    setIsPulling(false)

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(threshold) // Snap to threshold height during refresh

      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh])

  // Reset state when disabled
  useEffect(() => {
    if (!enabled) {
      setPullDistance(0)
      setIsPulling(false)
    }
  }, [enabled])

  const pullProgress = Math.min(pullDistance / threshold, 1)

  return {
    isRefreshing,
    pullDistance,
    pullProgress,
    isPulling,
    containerProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}
