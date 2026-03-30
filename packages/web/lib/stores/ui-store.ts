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

/**
 * UI Store State
 */
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

/**
 * UI Store Actions
 */
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

/**
 * Initial UI state
 */
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

/**
 * UI Store
 *
 * Centralized store for all UI state. Use this instead of scattered
 * useState calls throughout the app.
 *
 * Example usage:
 * ```tsx
 * import { useUIStore } from "@/lib/stores/ui-store"
 *
 * function MyComponent() {
 *   const { settingsOpen, openSettings, closeSettings } = useUIStore()
 *
 *   return (
 *     <button onClick={openSettings}>Open Settings</button>
 *   )
 * }
 * ```
 */
export const useUIStore = create<UIState & UIActions>()(
  devtools(
    (set) => ({
      ...initialState,

      // Sidebar actions
      openMobileSidebar: () => set({ mobileSidebarOpen: true }, false, "openMobileSidebar"),
      closeMobileSidebar: () => set({ mobileSidebarOpen: false }, false, "closeMobileSidebar"),
      toggleMobileSidebar: () =>
        set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen }), false, "toggleMobileSidebar"),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }, false, "setMobileSidebarOpen"),

      // Loading actions
      setMobileSandboxToggleLoading: (loading) =>
        set({ mobileSandboxToggleLoading: loading }, false, "setMobileSandboxToggleLoading"),
      setMobilePrLoading: (loading) =>
        set({ mobilePrLoading: loading }, false, "setMobilePrLoading"),

      // Settings modal actions
      openSettings: (highlightField) =>
        set(
          { settingsOpen: true, settingsHighlightField: highlightField ?? null },
          false,
          "openSettings"
        ),
      closeSettings: () =>
        set({ settingsOpen: false, settingsHighlightField: null }, false, "closeSettings"),
      clearSettingsHighlight: () =>
        set({ settingsHighlightField: null }, false, "clearSettingsHighlight"),

      // Add repo modal actions
      openAddRepo: () => set({ addRepoOpen: true }, false, "openAddRepo"),
      closeAddRepo: () => set({ addRepoOpen: false }, false, "closeAddRepo"),

      // Repo settings modal actions
      openRepoSettings: () => set({ repoSettingsOpen: true }, false, "openRepoSettings"),
      closeRepoSettings: () =>
        set({ repoSettingsOpen: false, repoEnvVars: null }, false, "closeRepoSettings"),
      setRepoEnvVars: (envVars) => set({ repoEnvVars: envVars }, false, "setRepoEnvVars"),

      // Mobile diff modal actions
      openMobileDiff: () => set({ mobileDiffOpen: true }, false, "openMobileDiff"),
      closeMobileDiff: () => set({ mobileDiffOpen: false }, false, "closeMobileDiff"),

      // Git history panel actions
      openGitHistory: () => set({ gitHistoryOpen: true }, false, "openGitHistory"),
      closeGitHistory: () => set({ gitHistoryOpen: false }, false, "closeGitHistory"),
      toggleGitHistory: () =>
        set((state) => ({ gitHistoryOpen: !state.gitHistoryOpen }), false, "toggleGitHistory"),
      triggerGitHistoryRefresh: () =>
        set(
          (state) => ({ gitHistoryRefreshTrigger: state.gitHistoryRefreshTrigger + 1 }),
          false,
          "triggerGitHistoryRefresh"
        ),

      // Desktop rebase conflict
      setDesktopRebaseConflict: (conflict) =>
        set({ desktopRebaseConflict: conflict }, false, "setDesktopRebaseConflict"),

      // Pending start commit
      setPendingStartCommit: (commit) =>
        set({ pendingStartCommit: commit }, false, "setPendingStartCommit"),
      clearPendingStartCommit: () =>
        set({ pendingStartCommit: null }, false, "clearPendingStartCommit"),

      // Reset all UI state
      resetUI: () => set(initialState, false, "resetUI"),
    }),
    { name: "ui-store" }
  )
)

/**
 * Selector hooks for common patterns
 */

// Mobile UI selectors
export const useMobileSidebar = () =>
  useUIStore((state) => ({
    isOpen: state.mobileSidebarOpen,
    open: state.openMobileSidebar,
    close: state.closeMobileSidebar,
    toggle: state.toggleMobileSidebar,
    setOpen: state.setMobileSidebarOpen,
  }))

export const useMobileLoadingStates = () =>
  useUIStore((state) => ({
    sandboxToggleLoading: state.mobileSandboxToggleLoading,
    prLoading: state.mobilePrLoading,
    setSandboxToggleLoading: state.setMobileSandboxToggleLoading,
    setPrLoading: state.setMobilePrLoading,
  }))

// Settings modal selectors
export const useSettingsModal = () =>
  useUIStore((state) => ({
    isOpen: state.settingsOpen,
    highlightField: state.settingsHighlightField,
    open: state.openSettings,
    close: state.closeSettings,
    clearHighlight: state.clearSettingsHighlight,
  }))

// Git history selectors
export const useGitHistoryPanel = () =>
  useUIStore((state) => ({
    isOpen: state.gitHistoryOpen,
    refreshTrigger: state.gitHistoryRefreshTrigger,
    open: state.openGitHistory,
    close: state.closeGitHistory,
    toggle: state.toggleGitHistory,
    refresh: state.triggerGitHistoryRefresh,
  }))
