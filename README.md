# Sandboxed Agents

A sophisticated multi-tenant web application that enables users to run AI coding agents (Claude Code, OpenCode, Codex) in isolated Daytona sandboxes. Features a Slack-like interface for managing AI-powered coding agents across multiple GitHub repositories with real-time streaming output, background execution, and persistent chat history.

## Features

### Core Capabilities
- **Multi-Agent Support** - Run Claude Code, OpenCode, or Codex agents with configurable models
- **GitHub OAuth Login** - Sign in with GitHub, OAuth tokens used for seamless repo access
- **Isolated Sandboxes** - Each branch gets its own Daytona sandbox environment
- **Real-time Streaming** - Live agent output via Server-Sent Events (SSE)
- **Background Execution** - Agent tasks continue even when browser is closed
- **Persistent Chat History** - Full conversation history with tool calls and content blocks
- **Loop Mode** - Agents automatically continue working until they respond "FINISHED"

### User Experience
- **Slack-like Interface** - Repository sidebar with branch-based conversations
- **Multi-tenant Architecture** - User data fully isolated, shared infrastructure
- **Quota Enforcement** - Configurable concurrent sandbox limits
- **Encrypted Credentials** - API keys stored AES-encrypted in database
- **Drag-and-Drop Reordering** - Customize repository order in sidebar
- **Dark Mode Support** - Theme switching with next-themes
- **Mobile Responsive** - Full mobile UI with drawer navigation

### Developer Features
- **Pull Request Integration** - Create PRs directly from branches
- **Git Diff Viewer** - Compare branches and view changes
- **Git History** - Browse commit history per branch
- **Environment Variables** - Per-repository encrypted env vars for sandboxes
- **Auto-Stop** - Configurable sandbox auto-stop intervals (5-20 minutes)

### Automation
- **Loop Mode** - Toggle per-branch to have agents continue until task completion
- **Configurable Iterations** - Set max loop iterations (1-25) in Settings → Automation
- **Background Loop Checking** - Vercel cron job continues loops even when browser is closed

---

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   Browser (React)   │────▶│   Next.js 16 API    │────▶│   Neon Postgres  │
│   - Shadcn/ui       │◀────│   (Vercel/Node)     │◀────│   (Serverless)   │
│   - SSE Streaming   │     │   - 34 API routes   │     │   - Prisma ORM   │
└─────────────────────┘     └──────────┬──────────┘     └──────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
          ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
          │  Daytona Cloud  │ │   GitHub API    │ │   LLM APIs      │
          │  (Sandboxes)    │ │   (OAuth)       │ │   - Anthropic   │
          │  - SDK control  │ │   - Repos/PRs   │ │   - OpenAI      │
          └────────┬────────┘ └─────────────────┘ └─────────────────┘
                   │
                   ▼
          ┌─────────────────┐
          │  Coding Agents  │
          │  - Claude Code  │
          │  - OpenCode     │
          │  - Codex        │
          └─────────────────┘
```

### Data Flow

1. **Authentication** - User authenticates via GitHub OAuth (NextAuth.js)
2. **Repository Setup** - User adds repositories from GitHub, creates branches
3. **Sandbox Creation** - Each branch spins up a Daytona sandbox with selected agent
4. **Chat Interaction** - User sends prompts → API streams agent output in real-time
5. **Agent Execution** - Agent reads/writes files, runs commands, makes commits
6. **Background Processing** - Long-running tasks continue server-side if browser closes
7. **Pull Requests** - User creates PRs from completed branch work

### Credential Management

| Credential | Storage | Access |
|------------|---------|--------|
| GitHub OAuth Token | NextAuth Account table | Server-side only, auto-refreshed |
| Daytona API Key | Environment variable | Shared infrastructure, server-side |
| Anthropic API Key | AES encrypted in database | User provides, decrypted at runtime |
| OpenAI API Key | AES encrypted in database | User provides, decrypted at runtime |
| OpenCode API Key | AES encrypted in database | User provides, decrypted at runtime |
| Repository Env Vars | AES encrypted in database | Per-repo, injected into sandbox |

---

## Tech Stack

### Frontend
- **Framework**: Next.js 16.1.6 (App Router, React 19)
- **UI Library**: Shadcn/ui (50+ Radix UI components)
- **Styling**: Tailwind CSS 4.2
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React (564 icons)
- **Charts**: Recharts
- **Notifications**: Sonner toast notifications
- **Markdown**: react-markdown for agent output

### Backend
- **Server**: Next.js API Routes (serverless)
- **ORM**: Prisma 7.4.2 with Neon adapter
- **Database**: PostgreSQL (Neon serverless)
- **Authentication**: NextAuth.js 4.24 (GitHub OAuth)
- **Encryption**: crypto-js (AES encryption)

### External Services
- **Sandboxes**: Daytona SDK (@daytonaio/sdk)
- **Agent Runner**: @jamesmurdza/coding-agents-sdk
- **LLM Providers**: Anthropic SDK, OpenAI SDK

---

## Setup

### Prerequisites

- Node.js 18+
- A Vercel account (for deployment + Neon integration)
- A GitHub account (for OAuth app)
- A Daytona API key

### 1. Neon Database

**Option A: Via Vercel (Recommended)**
1. Go to your Vercel project → **Storage** tab
2. Click **Create Database** → Select **Neon Postgres**
3. Vercel auto-adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` env vars

**Option B: Direct Setup**
1. Go to [neon.tech](https://neon.tech) → Create project
2. Copy the connection strings
3. Add to Vercel env vars:
   ```
   DATABASE_URL=postgres://...?sslmode=require
   DATABASE_URL_UNPOOLED=postgres://...?sslmode=require
   ```

### 2. GitHub OAuth App

1. Go to GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**
2. Fill in:
   - **Application name**: `Sandboxed Agents`
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Authorization callback URL**: `https://your-app.vercel.app/api/auth/callback/github`
3. Click **Register application**
4. Copy the **Client ID**
5. Generate a **Client Secret** and copy it

### 3. Generate Secrets

```bash
# NextAuth secret (32-byte base64)
openssl rand -base64 32

# Encryption key for API credentials (32-byte hex)
openssl rand -hex 32
```

### 4. Environment Variables

Add these to Vercel (Settings → Environment Variables):

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon pooled connection | (auto-set by Vercel) |
| `DATABASE_URL_UNPOOLED` | Neon direct connection (migrations) | (auto-set by Vercel) |
| `NEXTAUTH_URL` | Your app's URL | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | Random secret for NextAuth | (output of `openssl rand -base64 32`) |
| `GITHUB_CLIENT_ID` | From GitHub OAuth App | `Ov23li...` |
| `GITHUB_CLIENT_SECRET` | From GitHub OAuth App | `abc123...` |
| `ENCRYPTION_KEY` | For encrypting API keys | (output of `openssl rand -hex 32`) |
| `DAYTONA_API_KEY` | Your shared Daytona API key | `dtn_...` |
| `DAYTONA_API_URL` | Daytona API endpoint | `https://api.daytona.io` |
| `CRON_SECRET` | Secret for Vercel cron jobs (loop mode) | (output of `openssl rand -base64 32`) |

### 5. Deploy

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (uses DATABASE_URL_UNPOOLED)
npx prisma migrate deploy

# Build
npm run build
```

Or push to Vercel - the build script handles migrations automatically.

### 6. Setup Checklist

```
[ ] Neon database provisioned
[ ] DATABASE_URL set
[ ] DATABASE_URL_UNPOOLED set
[ ] GitHub OAuth App created
[ ] GITHUB_CLIENT_ID set
[ ] GITHUB_CLIENT_SECRET set
[ ] NEXTAUTH_URL set
[ ] NEXTAUTH_SECRET set
[ ] ENCRYPTION_KEY set
[ ] DAYTONA_API_KEY set
[ ] DAYTONA_API_URL set
[ ] CRON_SECRET set (optional, for loop mode)
```

---

## Development

### Quick Start

```bash
# Install dependencies
npm install

# Set up local env (copy from Vercel or create .env.local)
cp .env.example .env.local

# Run migrations
npx prisma migrate dev

# Start dev server
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with Webpack |
| `npm run dev:local` | Dev with local SDK + debug logs |
| `npm run build` | Prisma generate + Next.js build |
| `npm run start` | Production server |
| `npm run lint` | ESLint check |
| `npm run install:local` | Setup local SDK symlink |
| `npm run build-sdk` | Build local SDK |

### Local Environment

Create `.env.local`:

```env
DATABASE_URL="postgres://..."
DATABASE_URL_UNPOOLED="postgres://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-prod"
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
ENCRYPTION_KEY="..."
DAYTONA_API_KEY="dtn_..."
DAYTONA_API_URL="https://api.daytona.io"
```

> **Note**: For local GitHub OAuth, create a separate OAuth App with callback URL `http://localhost:3000/api/auth/callback/github`

### Local coding-agents-sdk Development

To develop against the local `@jamesmurdza/coding-agents-sdk` repo instead of the npm package:

1. **Switch to local SDK**:
   ```bash
   npm run install:local
   ```
   This installs deps, symlinks `node_modules/@jamesmurdza/coding-agents-sdk` to your local SDK path, and builds the SDK.

2. **Run dev with local SDK and debug logs**:
   ```bash
   npm run dev:local
   ```
   Runs `install:local` then `npm run dev` with `CODING_AGENTS_DEBUG=1`.

3. **After changing the SDK**, rebuild:
   ```bash
   npm run build-sdk
   ```

4. **Switch back to published SDK**:
   ```bash
   npm install
   ```

The local SDK path is configured in `scripts/link-local-sdk.js`.

---

## Database Schema

### Entity Relationship

```
User
├── id, name, email, image (NextAuth)
├── githubId, githubLogin
├── isAdmin, maxSandboxes (quota override)
├── repoOrder (JSON array for sidebar ordering)
├── credentials (1:1) → UserCredentials
├── repos (1:n) → Repo
└── sandboxes (1:n) → Sandbox

UserCredentials
├── anthropicApiKey (AES encrypted)
├── anthropicAuthType ("api-key" | "claude-max")
├── anthropicAuthToken (encrypted, for Claude Max)
├── openaiApiKey (AES encrypted)
├── opencodeApiKey (AES encrypted)
├── daytonaApiKey (optional custom key)
├── sandboxAutoStopInterval (5-20 minutes)
└── defaultLoopMaxIterations (1-25, default 10)

Repo
├── owner, name, avatar, defaultBranch
├── envVars (encrypted JSON)
└── branches (1:n) → Branch

Branch
├── name, baseBranch, startCommit
├── status ("idle" | "running" | "creating" | "stopped" | "error")
├── agent ("claude-code" | "opencode" | "codex")
├── model (selected model name)
├── draftPrompt (unsent message)
├── prUrl (pull request link)
├── loopEnabled, loopCount, loopMaxIterations (loop mode)
├── sandbox (1:1) → Sandbox
└── messages (1:n) → Message

Sandbox
├── sandboxId (format: agenthub-{userId}-{uuid})
├── contextId, sessionId (for SDK resumption)
├── sessionAgent (track agent type)
├── previewUrlPattern (web previews)
├── status, lastActiveAt
└── execution → AgentExecution

Message
├── role ("user" | "assistant")
├── content (full output text)
├── toolCalls (JSON array)
├── contentBlocks (interleaved text/tool order)
├── commitHash, commitMessage
├── timestamp
└── execution (1:1) → AgentExecution

AgentExecution
├── executionId (SDK execution ID)
├── status ("running" | "completed" | "error")
├── isLoopIteration (triggered by loop mode)
├── latestSnapshot (streaming content)
├── accumulatedEvents (full event list)
└── lastSnapshotPolledAt (500ms throttle)
```

---

## Streaming Protocol

Agent output streams via Server-Sent Events:

```typescript
// Frontend consumption
const response = await fetch("/api/agent/query", {
  method: "POST",
  credentials: "include",  // Session cookie
  body: JSON.stringify({ sandboxId, prompt }),
})

const reader = response.body.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // Parse SSE: "data: {...}\n\n"
}
```

### Event Types

| Type | Description | Payload |
|------|-------------|---------|
| `token` | Text content token | `{ content: "..." }` |
| `tool` | Tool call event | `{ toolCall: { tool: "Read", summary: "..." } }` |
| `stdout` | Standard output | `{ content: "..." }` |
| `stderr` | Error output | `{ content: "..." }` |
| `session-id` | Session for resumption | `{ sessionId: "..." }` |
| `context-updated` | Context ID updated | `{ contextId: "..." }` |
| `error` | Fatal error | `{ message: "..." }` |
| `done` | Query complete | `{}` |

---

## Background Execution

For long-running tasks, the app supports background execution that continues even when the browser is closed:

1. **Initiation**: Frontend calls `/api/agent/execute` instead of `/api/agent/query`
2. **Server-side Processing**: Agent runs in Daytona sandbox, events saved to `AgentExecution`
3. **Polling**: `BackgroundExecutionPoller` component polls `/api/agent/execution/active`
4. **Snapshot Updates**: Server saves snapshots every 500ms (throttled)
5. **Resumption**: On page reload, active executions are detected and resumed in UI

---

## Loop Mode

Loop mode allows agents to automatically continue working on multi-step tasks until they explicitly indicate completion.

### How It Works

1. **Enable Loop** - Click the loop toggle (🔁) next to the agent selector in the chat input
2. **Send Initial Prompt** - Describe your task to the agent
3. **Automatic Continuation** - When the agent finishes, it's asked to continue or say "FINISHED"
4. **Termination** - Loop stops when:
   - Agent responds with "FINISHED" (case-insensitive exact match)
   - Agent includes "FINISHED" (all caps) anywhere in response
   - Maximum iterations reached (configurable, default 10, max 25)
   - User toggles loop off

### Configuration

- **Default Max Iterations**: Settings → Automation tab (1-25, default 10)
- **Per-Branch Setting**: Each branch tracks its own loop state independently

### Background Loop Checking

A Vercel cron job runs every minute to check for completed executions where loop should continue:
- Handles cases where the browser is closed mid-loop
- Waits 15 seconds after completion before triggering (to let frontend handle first)
- Protected with `CRON_SECRET` environment variable

**Setup:**
1. Generate a secret: `openssl rand -base64 32`
2. Add `CRON_SECRET` to your Vercel environment variables
3. The cron job is automatically configured via `vercel.json` (runs every minute)

> **Note**: Vercel Cron is available on Pro and Enterprise plans. On the Hobby plan, you can use an external cron service (e.g., cron-job.org) to call `GET /api/cron/loop-check` with the `Authorization: Bearer <CRON_SECRET>` header.

### Continuation Message

When loop continues, the agent receives:
> "If you have finished all tasks, respond with just the phrase FINISHED. Otherwise, continue working on the remaining tasks."

---

## Agent & Model Support

### Supported Agents

| Agent | Provider | Models |
|-------|----------|--------|
| Claude Code | Anthropic | claude-sonnet-4-20250514, claude-3-7-sonnet-latest, claude-opus-4-20250514 |
| OpenCode | OpenCode | Various |
| Codex | OpenAI | codex-mini, o3, o4-mini, gpt-4.1-mini |

### Model Configuration

Models are configured per-branch in the chat header. The system automatically:
- Injects the correct API key based on model provider
- Persists model selection across sessions
- Validates model/agent compatibility

---

## Quotas & Limits

| Resource | Default Limit | Configurable |
|----------|---------------|--------------|
| Concurrent sandboxes | 10 per user | Per-user override via admin |
| Auto-stop interval | 10 minutes | User settings (5-20 min) |
| Sandbox statuses counted | CREATING, RUNNING, STOPPED | - |
| Message history | Unlimited | - |

When quota is reached, new sandbox creation is blocked until user stops an existing one.

---

## Security

### Data Protection
- **No credentials in localStorage** - All secrets stored server-side
- **Encrypted at rest** - API keys AES-256 encrypted in database
- **Session-based auth** - JWT via NextAuth, HTTP-only cookies
- **Parameterized queries** - Prisma prevents SQL injection

### Access Control
- **Sandbox isolation** - Users can only access their own sandboxes
- **Multi-tenant data** - All queries filtered by userId
- **Admin separation** - Admin routes require isAdmin flag

### External Services
- **Shared Daytona key** - Never exposed to frontend
- **OAuth token handling** - GitHub tokens stored in NextAuth Account table
- **Rate limiting** - Handled by external services (GitHub, Anthropic, etc.)

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run linting: `npm run lint`
5. Commit your changes: `git commit -m "Add my feature"`
6. Push to the branch: `git push origin feature/my-feature`
7. Open a Pull Request

---

## License

MIT
