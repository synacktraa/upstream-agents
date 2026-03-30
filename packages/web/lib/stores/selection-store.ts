/**
 * Selection State Store using Zustand
 *
 * Manages active repo and branch selection state.
 * This replaces the useBranchSelection hook for simpler state access.
 */

import { create } from "zustand"
import { devtools, subscribeWithSelector } from "zustand/middleware"

/**
 * Selection Store State
 */
interface SelectionState {
  // Active selections
  activeRepoId: string | null
  activeBranchId: string | null

  // Initial selection tracking
  initialSelectionDone: boolean
}

/**
 * Selection Store Actions
 */
interface SelectionActions {
  // Set active repo (also clears branch)
  setActiveRepoId: (repoId: string | null) => void

  // Set active branch
  setActiveBranchId: (branchId: string | null) => void

  // Select repo and its first branch
  selectRepo: (repoId: string, firstBranchId?: string | null) => void

  // Select branch (without changing repo)
  selectBranch: (branchId: string) => void

  // Update branch ID when it changes (e.g., during branch creation)
  updateActiveBranchId: (oldId: string, newId: string) => void

  // Mark initial selection as done
  markInitialSelectionDone: () => void

  // Reset selection state
  resetSelection: () => void
}

/**
 * Initial state
 */
const initialState: SelectionState = {
  activeRepoId: null,
  activeBranchId: null,
  initialSelectionDone: false,
}

/**
 * Selection Store
 *
 * Centralized store for active repo/branch selection.
 *
 * Example usage:
 * ```tsx
 * import { useSelectionStore } from "@/lib/stores/selection-store"
 *
 * function MyComponent() {
 *   const { activeRepoId, activeBranchId, selectRepo, selectBranch } = useSelectionStore()
 *
 *   return (
 *     <div>
 *       <p>Active Repo: {activeRepoId}</p>
 *       <p>Active Branch: {activeBranchId}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export const useSelectionStore = create<SelectionState & SelectionActions>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      setActiveRepoId: (repoId) =>
        set({ activeRepoId: repoId }, false, "setActiveRepoId"),

      setActiveBranchId: (branchId) =>
        set({ activeBranchId: branchId }, false, "setActiveBranchId"),

      selectRepo: (repoId, firstBranchId) =>
        set(
          {
            activeRepoId: repoId,
            activeBranchId: firstBranchId ?? null,
          },
          false,
          "selectRepo"
        ),

      selectBranch: (branchId) =>
        set({ activeBranchId: branchId }, false, "selectBranch"),

      updateActiveBranchId: (oldId, newId) => {
        const { activeBranchId } = get()
        if (activeBranchId === oldId) {
          set({ activeBranchId: newId }, false, "updateActiveBranchId")
        }
      },

      markInitialSelectionDone: () =>
        set({ initialSelectionDone: true }, false, "markInitialSelectionDone"),

      resetSelection: () => set(initialState, false, "resetSelection"),
    })),
    { name: "selection-store" }
  )
)

