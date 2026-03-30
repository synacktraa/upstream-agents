"use client"

import { useUIStore } from "@/lib/stores"

/**
 * Manages mobile-specific UI state (modals, drawers, loading states)
 * Now uses Zustand for state management.
 *
 * Note: merge/rebase/tag dialogs are now handled by the shared useGitDialogs hook
 */
export function useMobileUIState() {
  const {
    // Sidebar
    mobileSidebarOpen,
    setMobileSidebarOpen,

    // Loading states
    mobileSandboxToggleLoading,
    setMobileSandboxToggleLoading,
    mobilePrLoading,
    setMobilePrLoading,

    // Diff modal
    mobileDiffOpen,
    openMobileDiff,
    closeMobileDiff,
  } = useUIStore()

  return {
    // Sidebar
    mobileSidebarOpen,
    setMobileSidebarOpen,

    // Sandbox toggle
    mobileSandboxToggleLoading,
    setMobileSandboxToggleLoading,

    // PR creation
    mobilePrLoading,
    setMobilePrLoading,

    // Diff modal
    mobileDiffOpen,
    setMobileDiffOpen: (open: boolean) => (open ? openMobileDiff() : closeMobileDiff()),
  }
}

export type MobileUIState = ReturnType<typeof useMobileUIState>
