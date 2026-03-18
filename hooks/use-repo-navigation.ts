"use client"

import { useCallback, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"

interface RepoFromUrl {
  owner: string
  name: string
}

/**
 * Hook for URL-based repo navigation
 * Parses repo from URL path and provides navigation functions
 */
export function useRepoNavigation() {
  const router = useRouter()
  const pathname = usePathname()

  // Parse current repo from URL path
  // Matches: /repos/:owner/:repo
  const repoFromUrl = useMemo((): RepoFromUrl | null => {
    const match = pathname.match(/^\/repos\/([^/]+)\/([^/]+)/)
    if (match) {
      return {
        owner: decodeURIComponent(match[1]),
        name: decodeURIComponent(match[2]),
      }
    }
    return null
  }, [pathname])

  // Navigate to a specific repo
  const navigateToRepo = useCallback(
    (owner: string, name: string) => {
      const encodedOwner = encodeURIComponent(owner)
      const encodedName = encodeURIComponent(name)
      router.push(`/repos/${encodedOwner}/${encodedName}`)
    },
    [router]
  )

  // Navigate to home (no repo selected)
  const navigateHome = useCallback(() => {
    router.push("/")
  }, [router])

  return {
    repoFromUrl,
    navigateToRepo,
    navigateHome,
  }
}

export type RepoNavigation = ReturnType<typeof useRepoNavigation>
