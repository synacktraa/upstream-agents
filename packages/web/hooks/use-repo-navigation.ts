"use client"

import { useCallback, useMemo } from "react"
import { usePathname } from "next/navigation"

interface RepoFromUrl {
  owner: string
  name: string
}

// Reserved paths that should NOT be treated as owner/repo patterns
const RESERVED_PATHS = new Set([
  "api",
  "login",
  "admin",
  "team",
  "mcp-callback",
  "repo", // Keep supporting old /repo/ URLs for backwards compatibility
  "_next",
])

/**
 * Hook for URL-based repo navigation
 * Parses repo from URL path and provides navigation functions
 * Uses history.replaceState for URL updates to avoid page reloads
 *
 * URL pattern: /:owner/:repo (e.g., /facebook/react)
 * Reserved paths like /api, /login, /admin, etc. are excluded
 */
export function useRepoNavigation() {
  const pathname = usePathname()

  // Parse current repo from URL path
  // Matches: /:owner/:repo (but excludes reserved paths)
  // Also supports legacy /repo/:owner/:repo format for backwards compatibility
  const repoFromUrl = useMemo((): RepoFromUrl | null => {
    // First check for legacy /repo/ format
    const legacyMatch = pathname.match(/^\/repo\/([^/]+)\/([^/]+)/)
    if (legacyMatch) {
      return {
        owner: decodeURIComponent(legacyMatch[1]),
        name: decodeURIComponent(legacyMatch[2]),
      }
    }

    // Check for new format: /:owner/:repo
    const match = pathname.match(/^\/([^/]+)\/([^/]+)/)
    if (match) {
      const owner = decodeURIComponent(match[1])
      // Skip if it's a reserved path
      if (RESERVED_PATHS.has(owner.toLowerCase())) {
        return null
      }
      return {
        owner,
        name: decodeURIComponent(match[2]),
      }
    }
    return null
  }, [pathname])

  // Update URL to a specific repo without triggering navigation/reload
  const updateUrlToRepo = useCallback((owner: string, name: string) => {
    const encodedOwner = encodeURIComponent(owner)
    const encodedName = encodeURIComponent(name)
    const newUrl = `/${encodedOwner}/${encodedName}`

    // Use replaceState to update URL without reload
    // This keeps the URL in sync but doesn't trigger React re-render
    if (typeof window !== "undefined" && window.location.pathname !== newUrl) {
      window.history.replaceState(null, "", newUrl)
    }
  }, [])

  // Update URL to home without triggering navigation
  const updateUrlToHome = useCallback(() => {
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/")
    }
  }, [])

  return {
    repoFromUrl,
    updateUrlToRepo,
    updateUrlToHome,
  }
}

export type RepoNavigation = ReturnType<typeof useRepoNavigation>
