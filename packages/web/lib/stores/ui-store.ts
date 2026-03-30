/**
 * UI State Store using Zustand
 *
 * Manages application-wide UI state including:
 * - Modal open/close states
 * - Sidebar states
 * - Loading states
 * - Panel visibility
 */

import { create } from "zustand"
import { devtools } from "zustand/middleware"

interface UIState {
  // Sidebar
  mobileSidebarOpen: boolean

  // Loading states
  mobileSandboxToggleLoading: boolean
  mobilePrLoading: boolean

  // Modals
  settingsOpen: boolean
  settingsHighlightField: string | null
  addRepoOpen: boolean
  repoSettingsOpen: boolean
  mobileDiffOpen: boolean

  // Panels
  gitHistoryOpen: boolean
  gitHistoryRefreshTrigger: number

  // Desktop rebase conflict indicator
  desktopRebaseConflict: boolean

  // Repo settings data
  repoEnvVars: Record<string, boolean> | null

  // Pending state
  pendingStartCommit: string | null
}

interface UIActions {
  // Sidebar actions
  openMobileSidebar: () => void
  closeMobileSidebar: () => void
  toggleMobileSidebar: () => void
  setMobileSidebarOpen: (open: boolean) => void

  // Loading actions
  setMobileSandboxToggleLoading: (loading: boolean) => void
  setMobilePrLoading: (loading: boolean) => void

  // Settings modal actions
  openSettings: (highlightField?: string) => void
  closeSettings: () => void
  clearSettingsHighlight: () => void

  // Add repo modal actions
  openAddRepo: () => void
  closeAddRepo: () => void

  // Repo settings modal actions
  openRepoSettings: () => void
  closeRepoSettings: () => void
  setRepoEnvVars: (envVars: Record<string, boolean> | null) => void

  // Mobile diff modal actions
  openMobileDiff: () => void
  closeMobileDiff: () => void

  // Git history panel actions
  openGitHistory: () => void
  closeGitHistory: () => void
  toggleGitHistory: () => void
  triggerGitHistoryRefresh: () => void

  // Desktop rebase conflict
  setDesktopRebaseConflict: (conflict: boolean) => void

  // Pending start commit
  setPendingStartCommit: (commit: string | null) => void
  clearPendingStartCommit: () => void

  // Reset all UI state
  resetUI: () => void
}

const initialState: UIState = {
  mobileSidebarOpen: false,
  mobileSandboxToggleLoading: false,
  mobilePrLoading: false,
  settingsOpen: false,
  settingsHighlightField: null,
  addRepoOpen: false,
  repoSettingsOpen: false,
  mobileDiffOpen: false,
  gitHistoryOpen: false,
  gitHistoryRefreshTrigger: 0,
  desktopRebaseConflict: false,
  repoEnvVars: null,
  pendingStartCommit: null,
}

const storeCreator = (set: (partial: Partial<UIState & UIActions>) => void, get: () => UIState & UIActions) => ({
  ...initialState,

  // Sidebar actions
  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  toggleMobileSidebar: () => set({ mobileSidebarOpen: !get().mobileSidebarOpen }),
  setMobileSidebarOpen: (open: boolean) => set({ mobileSidebarOpen: open }),

  // Loading actions
  setMobileSandboxToggleLoading: (loading: boolean) => set({ mobileSandboxToggleLoading: loading }),
  setMobilePrLoading: (loading: boolean) => set({ mobilePrLoading: loading }),

  // Settings modal actions
  openSettings: (highlightField?: string) =>
    set({ settingsOpen: true, settingsHighlightField: highlightField ?? null }),
  closeSettings: () => set({ settingsOpen: false, settingsHighlightField: null }),
  clearSettingsHighlight: () => set({ settingsHighlightField: null }),

  // Add repo modal actions
  openAddRepo: () => set({ addRepoOpen: true }),
  closeAddRepo: () => set({ addRepoOpen: false }),

  // Repo settings modal actions
  openRepoSettings: () => set({ repoSettingsOpen: true }),
  closeRepoSettings: () => set({ repoSettingsOpen: false, repoEnvVars: null }),
  setRepoEnvVars: (envVars: Record<string, boolean> | null) => set({ repoEnvVars: envVars }),

  // Mobile diff modal actions
  openMobileDiff: () => set({ mobileDiffOpen: true }),
  closeMobileDiff: () => set({ mobileDiffOpen: false }),

  // Git history panel actions
  openGitHistory: () => set({ gitHistoryOpen: true }),
  closeGitHistory: () => set({ gitHistoryOpen: false }),
  toggleGitHistory: () => set({ gitHistoryOpen: !get().gitHistoryOpen }),
  triggerGitHistoryRefresh: () => set({ gitHistoryRefreshTrigger: get().gitHistoryRefreshTrigger + 1 }),

  // Desktop rebase conflict
  setDesktopRebaseConflict: (conflict: boolean) => set({ desktopRebaseConflict: conflict }),

  // Pending start commit
  setPendingStartCommit: (commit: string | null) => set({ pendingStartCommit: commit }),
  clearPendingStartCommit: () => set({ pendingStartCommit: null }),

  // Reset all UI state
  resetUI: () => set(initialState),
})

// Only use devtools in development
export const useUIStore =
  process.env.NODE_ENV === "development"
    ? create<UIState & UIActions>()(devtools(storeCreator, { name: "ui-store" }))
    : create<UIState & UIActions>()(storeCreator)
