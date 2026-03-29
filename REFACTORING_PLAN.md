# Sandboxed Agents: Simple Refactoring Plan

A practical plan to tidy up the codebase. Half-day of work, not 10 weeks.

---

## What's Actually Fine

- ✅ 2-package structure (`background-agents` + `web`) makes sense
- ✅ SDK has clean provider abstraction
- ✅ Prisma schema is well-designed
- ✅ Hooks are already organized with barrel exports
- ✅ npm workspaces works fine for this size

---

## What Needs Tidying

### 1. Organize `/lib` into folders

**Current:** 34 files dumped flat

**Proposed:**
```
lib/
├── agents/           # Agent execution logic
│   ├── agent-events.ts
│   ├── agent-session.ts
│   ├── claude-hooks.ts
│   ├── codex-rules.ts
│   └── opencode-permissions.ts
│
├── auth/             # Authentication
│   ├── auth.ts
│   ├── dev-auth.ts
│   └── encryption.ts
│
├── db/               # Database
│   ├── prisma.ts
│   ├── prisma-includes.ts
│   └── db-types.ts
│
├── git/              # Git operations
│   ├── git-actions.ts
│   ├── branch-actions.ts
│   ├── branch-utils.ts
│   ├── commit-message.ts
│   └── github-client.ts
│
├── mcp/              # MCP integration
│   ├── mcp-config.ts
│   ├── mcp-oauth.ts
│   └── smithery-connect.ts
│
├── sandbox/          # Sandbox management
│   ├── sandbox-utils.ts
│   ├── sandbox-resume.ts
│   ├── quota.ts
│   └── daytona-cleanup.ts
│
├── llm/              # LLM providers
│   ├── llm.ts
│   └── streaming-helpers.ts
│
└── shared/           # Truly shared utilities
    ├── utils.ts
    ├── types.ts
    ├── schemas.ts
    ├── constants.ts
    ├── api-helpers.ts
    ├── sse-utils.ts
    ├── state-utils.ts
    ├── store.ts
    └── activity-log.ts
```

### 2. Organize `/components` better

**Current:** Mostly flat with a few folders

**Proposed:**
```
components/
├── ui/               # Keep as-is (shadcn primitives)
│
├── chat/             # Keep as-is (already organized)
│   ├── hooks/
│   └── ...
│
├── git/              # Keep as-is (already organized)
│   ├── dialogs/
│   ├── hooks/
│   └── ...
│
├── icons/            # Keep as-is
│
├── modals/           # Group all modals together
│   ├── add-repo-modal.tsx
│   ├── diff-modal.tsx
│   ├── settings-modal.tsx
│   ├── repo-settings-modal.tsx
│   ├── delete-branch-dialog.tsx
│   └── switch-agent-dialog.tsx
│
├── sidebar/          # Sidebar-related components
│   ├── repo-sidebar.tsx
│   ├── branch-list.tsx
│   └── mobile-sidebar-drawer.tsx
│
├── layout/           # Layout components
│   ├── mobile-header.tsx
│   ├── providers.tsx
│   └── theme-provider.tsx
│
└── panels/           # Main panel components
    ├── chat-panel.tsx
    ├── git-history-panel.tsx
    └── git-history-sheet.tsx
```

---

## Implementation Steps

### Step 1: Create folder structure (5 min)
```bash
# lib folders
mkdir -p packages/web/lib/{agents,auth,db,git,mcp,sandbox,llm,shared}

# component folders
mkdir -p packages/web/components/{modals,sidebar,layout,panels}
```

### Step 2: Move lib files (15 min)

```bash
# agents/
mv lib/agent-events.ts lib/agents/
mv lib/agent-session.ts lib/agents/
mv lib/claude-hooks.ts lib/agents/
mv lib/codex-rules.ts lib/agents/
mv lib/opencode-permissions.ts lib/agents/

# auth/
mv lib/auth.ts lib/auth/
mv lib/dev-auth.ts lib/auth/
mv lib/encryption.ts lib/auth/

# db/
mv lib/prisma.ts lib/db/
mv lib/prisma-includes.ts lib/db/
mv lib/db-types.ts lib/db/

# git/
mv lib/git-actions.ts lib/git/
mv lib/branch-actions.ts lib/git/
mv lib/branch-utils.ts lib/git/
mv lib/commit-message.ts lib/git/
mv lib/github-client.ts lib/git/

# mcp/
mv lib/mcp-config.ts lib/mcp/
mv lib/mcp-oauth.ts lib/mcp/
mv lib/smithery-connect.ts lib/mcp/

# sandbox/
mv lib/sandbox-utils.ts lib/sandbox/
mv lib/sandbox-resume.ts lib/sandbox/
mv lib/quota.ts lib/sandbox/
mv lib/daytona-cleanup.ts lib/sandbox/

# llm/
mv lib/llm.ts lib/llm/
mv lib/streaming-helpers.ts lib/llm/

# shared/ (everything else)
mv lib/utils.ts lib/shared/
mv lib/types.ts lib/shared/
mv lib/schemas.ts lib/shared/
mv lib/constants.ts lib/shared/
mv lib/api-helpers.ts lib/shared/
mv lib/sse-utils.ts lib/shared/
mv lib/state-utils.ts lib/shared/
mv lib/store.ts lib/shared/
mv lib/activity-log.ts lib/shared/
```

### Step 3: Move component files (10 min)

```bash
# modals/
mv components/add-repo-modal.tsx components/modals/
mv components/diff-modal.tsx components/modals/
mv components/settings-modal.tsx components/modals/
mv components/repo-settings-modal.tsx components/modals/
mv components/delete-branch-dialog.tsx components/modals/
mv components/switch-agent-dialog.tsx components/modals/

# sidebar/
mv components/repo-sidebar.tsx components/sidebar/
mv components/branch-list.tsx components/sidebar/
mv components/mobile-sidebar-drawer.tsx components/sidebar/

# layout/
mv components/mobile-header.tsx components/layout/
mv components/providers.tsx components/layout/
mv components/theme-provider.tsx components/layout/

# panels/
mv components/chat-panel.tsx components/panels/
mv components/git-history-panel.tsx components/panels/
mv components/git-history-sheet.tsx components/panels/
```

### Step 4: Add barrel exports (15 min)

Create `index.ts` in each lib folder:

```typescript
// lib/agents/index.ts
export * from './agent-events';
export * from './agent-session';
export * from './claude-hooks';
export * from './codex-rules';
export * from './opencode-permissions';
```

Same pattern for each folder.

### Step 5: Update imports (1-2 hours)

Find and replace imports across the codebase:

```typescript
// Before
import { parseAgentEvents } from '@/lib/agent-events';
import { prisma } from '@/lib/prisma';

// After
import { parseAgentEvents } from '@/lib/agents';
import { prisma } from '@/lib/db';
```

### Step 6: Verify & test (30 min)

```bash
npm run build
npm run lint
npm run dev  # manual smoke test
```

---

## Optional: Add Turborepo

If builds feel slow, add Turborepo for caching:

```bash
npm install turbo --save-dev
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {}
  }
}
```

But honestly, npm workspaces is fine for 2 packages.

---

## What NOT to do

- ❌ Don't create 10 new packages
- ❌ Don't add pnpm (npm works fine)
- ❌ Don't create a "services layer"
- ❌ Don't add repository pattern
- ❌ Don't extract API routes to separate package
- ❌ Don't spend 10 weeks on this

---

## Summary

| Task | Time |
|------|------|
| Create folders | 5 min |
| Move lib files | 15 min |
| Move component files | 10 min |
| Add barrel exports | 15 min |
| Update imports | 1-2 hours |
| Verify & test | 30 min |
| **Total** | **~3 hours** |

That's it. The architecture is already good. This just tidies up file organization.
