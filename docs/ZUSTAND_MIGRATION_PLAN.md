# Zustand Migration Plan

## Overview

This document outlines the migration plan for adopting Zustand in the sandboxed-agents web application. Zustand will manage client-side UI state, complementing TanStack Query which handles server state.

**Current State:** Multiple `useState` calls scattered across components and custom hooks.

**Target State:** Centralized Zustand stores for UI state with simple, direct access.

---

## Table of Contents

1. [Goals & Benefits](#1-goals--benefits)
2. [Store Architecture](#2-store-architecture)
3. [Created Stores](#3-created-stores)
4. [Migration Strategy](#4-migration-strategy)
5. [Usage Examples](#5-usage-examples)
6. [Integration with TanStack Query](#6-integration-with-tanstack-query)

---

## 1. Goals & Benefits

### Primary Goals

1. **Eliminate prop drilling** - Direct store access from any component
2. **Centralized state** - Single source of truth for UI state
3. **Simpler components** - Less useState/useCallback boilerplate
4. **Better DevTools** - Zustand devtools for state inspection
5. **Persistence ready** - Easy to add localStorage/sessionStorage persistence

### Expected Benefits

| Benefit | Current Pain Point | Zustand Solution |
|---------|-------------------|------------------|
| Reduced prop drilling | Modal states passed through 4+ levels | Direct store access |
| Simpler state updates | Multiple setState calls coordinated | Single store action |
| State persistence | Manual localStorage handling | Built-in persist middleware |
| Debugging | Scattered state, hard to track | Centralized, devtools |
| Code organization | State logic mixed with UI | Clear separation |

---

## 2. Store Architecture

### Store Separation

Following best practices, we separate stores by domain:

```
lib/stores/
├── index.ts           # Re-exports all stores
├── ui-store.ts        # UI state (modals, sidebars, loading)
└── selection-store.ts # Active repo/branch selection
```

### State Categories

| Category | Store | Description |
|----------|-------|-------------|
| UI State | `useUIStore` | Modals, sidebars, panels, loading states |
| Selection | `useSelectionStore` | Active repo/branch IDs |
| Server State | TanStack Query | Repos, branches, messages, user data |

---

## 3. Created Stores

### UI Store (`ui-store.ts`)

Manages all UI-related state:

```typescript
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

  // Other
  desktopRebaseConflict: boolean
  repoEnvVars: Record<string, boolean> | null
  pendingStartCommit: string | null
}
```

**Actions:**
- `openSettings(highlightField?)` / `closeSettings()`
- `openAddRepo()` / `closeAddRepo()`
- `openRepoSettings()` / `closeRepoSettings()`
- `openMobileSidebar()` / `closeMobileSidebar()` / `toggleMobileSidebar()`
- `openGitHistory()` / `closeGitHistory()` / `toggleGitHistory()`
- `triggerGitHistoryRefresh()`
- And more...

**Selector Hooks:**
- `useMobileSidebar()` - Sidebar state and actions
- `useMobileLoadingStates()` - Loading state and setters
- `useSettingsModal()` - Settings modal state and actions
- `useGitHistoryPanel()` - Git history panel state and actions

### Selection Store (`selection-store.ts`)

Manages active repo/branch selection:

```typescript
interface SelectionState {
  activeRepoId: string | null
  activeBranchId: string | null
  initialSelectionDone: boolean
}
```

**Actions:**
- `selectRepo(repoId, firstBranchId?)` - Select repo and optionally its first branch
- `selectBranch(branchId)` - Select a branch
- `setActiveRepoId(repoId)` / `setActiveBranchId(branchId)` - Direct setters
- `updateActiveBranchId(oldId, newId)` - Update when ID changes (e.g., branch creation)
- `markInitialSelectionDone()` - Mark initial selection complete
- `resetSelection()` - Reset to initial state

**Utilities:**
- `useActiveIds()` - Selector for just the IDs
- `getSelectionState()` - Get state outside React
- `subscribeToSelectionChanges()` - Subscribe to changes

---

## 4. Migration Strategy

### Phase 1: Foundation (Complete)

1. ✅ Install Zustand
2. ✅ Create store structure
3. ✅ Create UI store with all states
4. ✅ Create selection store
5. ✅ Add TypeScript types
6. ✅ Add devtools middleware

### Phase 2: Component Migration (Future)

Migrate components to use Zustand stores:

```tsx
// Before - with useState and props
function MyComponent({ settingsOpen, setSettingsOpen }) {
  return (
    <button onClick={() => setSettingsOpen(true)}>
      Open Settings
    </button>
  )
}

// After - with Zustand
function MyComponent() {
  const { openSettings } = useSettingsModal()
  return (
    <button onClick={() => openSettings()}>
      Open Settings
    </button>
  )
}
```

### Migration Order

1. **Start with leaf components** - Modals that only need their own state
2. **Move up to containers** - Components that coordinate multiple modals
3. **Finally the root** - Remove state from page.tsx

### Components to Migrate

| Component | Current State | Target Store |
|-----------|--------------|--------------|
| `SettingsModal` | `settingsOpen` prop | `useSettingsModal()` |
| `AddRepoModal` | `addRepoOpen` prop | `useUIStore` |
| `RepoSettingsModal` | `repoSettingsOpen` prop | `useUIStore` |
| `MobileSidebarDrawer` | `mobileSidebarOpen` prop | `useMobileSidebar()` |
| `GitHistoryPanel` | `gitHistoryOpen` prop | `useGitHistoryPanel()` |
| `DiffModal` | `mobileDiffOpen` prop | `useUIStore` |
| `RepoSidebar` | `activeRepoId` prop | `useSelectionStore` |
| `BranchList` | `activeBranchId` prop | `useSelectionStore` |
| `ChatPanel` | Multiple props | Multiple stores |

---

## 5. Usage Examples

### Basic Usage

```tsx
import { useUIStore } from "@/lib/stores"

function SettingsButton() {
  const openSettings = useUIStore((state) => state.openSettings)

  return (
    <button onClick={() => openSettings()}>
      Settings
    </button>
  )
}
```

### With Selector Hooks

```tsx
import { useSettingsModal } from "@/lib/stores"

function SettingsButton() {
  const { isOpen, open, close } = useSettingsModal()

  return (
    <>
      <button onClick={open}>Settings</button>
      {isOpen && <SettingsModal onClose={close} />}
    </>
  )
}
```

### Multiple State Values

```tsx
import { useUIStore } from "@/lib/stores"

function Header() {
  // Subscribe to multiple values efficiently
  const { settingsOpen, addRepoOpen, openSettings, openAddRepo } = useUIStore(
    (state) => ({
      settingsOpen: state.settingsOpen,
      addRepoOpen: state.addRepoOpen,
      openSettings: state.openSettings,
      openAddRepo: state.openAddRepo,
    })
  )

  return (
    <header>
      <button onClick={openSettings}>Settings</button>
      <button onClick={openAddRepo}>Add Repo</button>
    </header>
  )
}
```

### Selection with URL Sync

```tsx
import { useSelectionStore, subscribeToSelectionChanges } from "@/lib/stores"
import { useEffect } from "react"

function App() {
  const { selectRepo } = useSelectionStore()

  // Sync selection to URL
  useEffect(() => {
    return subscribeToSelectionChanges((state, prevState) => {
      if (state.activeRepoId !== prevState.activeRepoId) {
        // Update URL when repo changes
        const repo = getRepoById(state.activeRepoId)
        if (repo) {
          window.history.replaceState(null, "", `/${repo.owner}/${repo.name}`)
        }
      }
    })
  }, [])

  return <RepoList onSelect={selectRepo} />
}
```

### Outside React Components

```tsx
import { useUIStore, getSelectionState } from "@/lib/stores"

// In an event handler or utility function
function handleExternalEvent() {
  // Get current state
  const { activeRepoId, activeBranchId } = getSelectionState()

  // Update state
  useUIStore.getState().openSettings()
}
```

---

## 6. Integration with TanStack Query

### Clear Separation

| Data Type | Solution | Example |
|-----------|----------|---------|
| Server data | TanStack Query | Repos, branches, messages, user |
| UI state | Zustand | Modals, selection, loading |

### Using Together

```tsx
import { useUserData } from "@/lib/api"
import { useSelectionStore, useUIStore } from "@/lib/stores"

function RepoList() {
  // Server state from TanStack Query
  const { data } = useUserData()
  const repos = data?.repos ?? []

  // UI state from Zustand
  const { activeRepoId, selectRepo } = useSelectionStore()
  const { openAddRepo } = useUIStore()

  return (
    <div>
      {repos.map((repo) => (
        <button
          key={repo.id}
          onClick={() => selectRepo(repo.id, repo.branches[0]?.id)}
          className={repo.id === activeRepoId ? "active" : ""}
        >
          {repo.name}
        </button>
      ))}
      <button onClick={openAddRepo}>Add Repo</button>
    </div>
  )
}
```

### Deriving Data

For computed values that depend on both server and UI state:

```tsx
import { useUserData } from "@/lib/api"
import { useSelectionStore } from "@/lib/stores"
import { useMemo } from "react"

function useActiveRepo() {
  const { data } = useUserData()
  const { activeRepoId } = useSelectionStore()

  return useMemo(
    () => data?.repos.find((r) => r.id === activeRepoId) ?? null,
    [data?.repos, activeRepoId]
  )
}

function useActiveBranch() {
  const activeRepo = useActiveRepo()
  const { activeBranchId } = useSelectionStore()

  return useMemo(
    () => activeRepo?.branches.find((b) => b.id === activeBranchId) ?? null,
    [activeRepo, activeBranchId]
  )
}
```

---

## Summary

This migration plan establishes Zustand as the client-side state management solution, working alongside TanStack Query for server state. The stores are designed to:

1. **Be simple** - Minimal API, easy to understand
2. **Be type-safe** - Full TypeScript support
3. **Be debuggable** - Devtools integration
4. **Be gradual** - Can migrate components incrementally

The foundation is now in place. Components can be migrated one at a time, and the existing hooks will continue to work during the transition.
