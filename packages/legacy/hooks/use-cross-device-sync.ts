"use client"

import { useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { queryKeys } from "@/lib/api/query-keys"
import { apiFetch } from "@/lib/api/fetcher"

interface SyncBranch {
  id: string
  name: string
  status: string
  baseBranch: string | null
  prUrl: string | null
  agent: string | null
  model: string | null
  sandboxId: string | null
  sandboxStatus: string | null
  lastMessageId: string | null
  lastMessageAt: number | null
}

interface SyncRepo {
  id: string
  name: string
  owner: string
  avatar: string | null
  defaultBranch: string
  branches: SyncBranch[]
}

interface SyncData {
  timestamp: number
  repos: SyncRepo[]
}

interface UseCrossDeviceSyncOptions {
  enabled?: boolean
  interval?: number // polling interval in ms
  onSyncData?: (data: SyncData, lastData: SyncData | null) => void
}

/**
 * Fetch sync data from the API
 */
async function fetchSyncData(): Promise<SyncData> {
  return apiFetch<SyncData>("/api/sync")
}

/**
 * Cross-device sync using TanStack Query polling
 *
 * Features:
 * - Automatic polling at configurable interval
 * - Pauses when tab is hidden (refetchIntervalInBackground: false)
 * - Immediate refetch when tab becomes visible
 * - Change detection via onSyncData callback
 */
export function useCrossDeviceSync({
  enabled = true,
  interval = 5000, // 5 seconds default
  onSyncData,
}: UseCrossDeviceSyncOptions) {
  const { status } = useSession()
  const isAuthenticated = status === "authenticated"

  // Track previous data for change detection
  const prevDataRef = useRef<SyncData | null>(null)

  // Store callback in ref to avoid recreating query
  const onSyncDataRef = useRef(onSyncData)
  onSyncDataRef.current = onSyncData

  const query = useQuery({
    queryKey: queryKeys.sync.data(),
    queryFn: async () => {
      const data = await fetchSyncData()

      // Call handler with previous data for comparison
      if (onSyncDataRef.current) {
        onSyncDataRef.current(data, prevDataRef.current)
      }
      prevDataRef.current = data

      return data
    },
    enabled: enabled && isAuthenticated,
    // Polling configuration
    refetchInterval: interval,
    // Pause polling when tab is hidden
    refetchIntervalInBackground: false,
    // Refetch immediately when window regains focus
    refetchOnWindowFocus: true,
    // Data is considered fresh for slightly less than the polling interval
    staleTime: interval - 1000,
    // Don't retry on error - next poll will try again
    retry: false,
  })

  // Manual sync trigger
  const sync = useCallback(() => {
    query.refetch()
  }, [query])

  return { sync }
}
