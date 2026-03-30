/**
 * Selection State Store using Zustand
 *
 * Manages active repo and branch selection state.
 */

import { create } from "zustand"
import { devtools } from "zustand/middleware"

interface SelectionState {
  activeRepoId: string | null
  activeBranchId: string | null
  initialSelectionDone: boolean
}

interface SelectionActions {
  setActiveRepoId: (repoId: string | null) => void
  setActiveBranchId: (branchId: string | null) => void
  selectRepo: (repoId: string, firstBranchId?: string | null) => void
  selectBranch: (branchId: string) => void
  updateActiveBranchId: (oldId: string, newId: string) => void
  markInitialSelectionDone: () => void
  resetSelection: () => void
}

const initialState: SelectionState = {
  activeRepoId: null,
  activeBranchId: null,
  initialSelectionDone: false,
}

const storeCreator = (set: (partial: Partial<SelectionState & SelectionActions>) => void, get: () => SelectionState & SelectionActions) => ({
  ...initialState,

  setActiveRepoId: (repoId: string | null) => set({ activeRepoId: repoId }),
  setActiveBranchId: (branchId: string | null) => set({ activeBranchId: branchId }),

  selectRepo: (repoId: string, firstBranchId?: string | null) =>
    set({ activeRepoId: repoId, activeBranchId: firstBranchId ?? null }),

  selectBranch: (branchId: string) => set({ activeBranchId: branchId }),

  updateActiveBranchId: (oldId: string, newId: string) => {
    if (get().activeBranchId === oldId) {
      set({ activeBranchId: newId })
    }
  },

  markInitialSelectionDone: () => set({ initialSelectionDone: true }),
  resetSelection: () => set(initialState),
})

// Only use devtools in development
export const useSelectionStore =
  process.env.NODE_ENV === "development"
    ? create<SelectionState & SelectionActions>()(devtools(storeCreator, { name: "selection-store" }))
    : create<SelectionState & SelectionActions>()(storeCreator)
