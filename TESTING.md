# Testing procedures

This document describes how to run unit tests and Playwright end-to-end tests.

The structure begins with the simplest setup and progresses to the more involved one.

**Note:** PostgreSQL install commands below are for **Linux** (Debian/Ubuntu-style). Adapt for other OSes.

---

## Unit tests

Unit tests need no database and no env files.

Run the command below from the repo root.

```bash
npm run test -w @upstream/agents
```

---

## Agent SDK integration tests

Integration tests verify that each AI coding agent provider (Claude, Codex, Gemini, OpenCode) works correctly in both streaming and background modes. These tests create real Daytona sandboxes and run actual provider CLIs.

**Required environment variables:**

| Provider | Required Keys |
|----------|---------------|
| Claude | `DAYTONA_API_KEY`, `ANTHROPIC_API_KEY` |
| Codex | `DAYTONA_API_KEY`, `OPENAI_API_KEY` |
| Gemini | `DAYTONA_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) |
| OpenCode | `DAYTONA_API_KEY`, `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) |

Tests are automatically skipped when required API keys are not set.

### Provider tests

Tests all 4 providers in both streaming and background modes. Verifies:
- Simple prompt completion with token and end events
- `isRunning` state transitions
- `getPid` returns pid while running, null after completion
- Session event with id in streaming mode

Run from the repo root:

```bash
DAYTONA_API_KEY=... ANTHROPIC_API_KEY=... OPENAI_API_KEY=... GEMINI_API_KEY=... \
  npm test -w @upstream/agents -- tests/integration/providers.test.ts
```

### Background session lifecycle tests

Comprehensive tests for background session features using Claude. Verifies:
- Session reattachment (create session, reattach by id, continue polling)
- Multiple sequential turns in same session
- Cancellation (cancel running process, start new turn after)
- Crash detection (process exits without end event)
- Concurrent polling (multiple getEvents calls)
- Process lifecycle (isRunning, getPid state machine)
- Edge cases (empty prompt, very long prompt)

Run from the repo root:

```bash
DAYTONA_API_KEY=... ANTHROPIC_API_KEY=... \
  npm test -w @upstream/agents -- tests/integration/sandbox-background.test.ts
```

### Run all agent SDK tests

```bash
DAYTONA_API_KEY=... ANTHROPIC_API_KEY=... OPENAI_API_KEY=... GEMINI_API_KEY=... \
  npm test -w @upstream/agents
```

---

## Database setup

You need a Postgres database for Playwright below.

Set up a local database by running the commands below.

```bash
sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER sandboxed WITH PASSWORD 'sandboxed123';"
sudo -u postgres psql -c "CREATE DATABASE sandboxed_agents OWNER sandboxed;"
```

Example connection strings for that local setup:

```text
DATABASE_URL="postgresql://sandboxed:sandboxed123@localhost:5432/sandboxed_agents"
DATABASE_URL_UNPOOLED="postgresql://sandboxed:sandboxed123@localhost:5432/sandboxed_agents"
```

When the schema changes, apply it by running the command below from `packages/web`:

```bash
DATABASE_URL="<same as the DATABASE_URL you configured>" npx prisma db push
```

---

## Playwright end-to-end tests

**Secrets:** In the **repo root** `.env`, you only need `DAYTONA_API_KEY` (`packages/web/playwright.config.ts` loads it).

**Note:** In a sandbox environment, take the `DAYTONA_API_KEY` from the shell environment variables.

**Database:** Use a database from [Database setup](#database-setup). Prefer a **separate** database from your dev DB so E2E does not overwrite local data. In `packages/web/.env.e2e`, set `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (same value is fine), `NEXTAUTH_SECRET`, and `ENCRYPTION_KEY`.

Run the command below from `packages/web`.

```bash
npm run test:e2e
```
