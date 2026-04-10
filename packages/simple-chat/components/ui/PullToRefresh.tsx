"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePullToRefresh } from "@/lib/hooks/usePullToRefresh"

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  enabled?: boolean
  children: React.ReactNode
  className?: string
}

export function PullToRefresh({
  onRefresh,
  enabled = true,
  children,
  className,
}: PullToRefreshProps) {
  const {
    isRefreshing,
    pullDistance,
    pullProgress,
    containerProps,
  } = usePullToRefresh({
    onRefresh,
    enabled,
    threshold: 80,
  })

  return (
    <div className={cn("relative", className)}>
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center overflow-hidden",
          "transition-opacity duration-200",
          pullDistance > 0 || isRefreshing ? "opacity-100" : "opacity-0"
        )}
        style={{
          height: pullDistance,
          top: 0,
        }}
      >
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full bg-muted shadow-sm",
            "transition-transform duration-200"
          )}
          style={{
            transform: `rotate(${pullProgress * 360}deg)`,
          }}
        >
          <Loader2
            className={cn(
              "h-5 w-5 text-muted-foreground",
              isRefreshing && "animate-spin"
            )}
          />
        </div>
      </div>

      {/* Content container */}
      <div
        className="overflow-y-auto mobile-scroll h-full"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 && !isRefreshing ? "transform 0.2s ease-out" : undefined,
        }}
        {...containerProps}
      >
        {children}
      </div>
    </div>
  )
}
