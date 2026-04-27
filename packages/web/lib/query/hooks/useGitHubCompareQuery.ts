"use client"

import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { queryKeys } from "../keys"

export interface CompareResult {
  ahead_by: number
  behind_by: number
  status: "ahead" | "behind" | "identical" | "diverged"
}

/**
 * Compares two branches in a GitHub repository.
 * Useful for showing merge/rebase status.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param base - Base branch to compare against
 * @param head - Head branch to compare
 */
export function useGitHubCompareQuery(
  owner: string,
  repo: string,
  base: string,
  head: string
) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.github.compare(owner, repo, base, head),
    queryFn: async (): Promise<CompareResult> => {
      const res = await fetch("/api/github/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, base, head }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Failed to compare branches")
      }

      return res.json()
    },
    enabled: !!session?.accessToken && !!owner && !!repo && !!base && !!head,
    staleTime: 30 * 1000,
  })
}
