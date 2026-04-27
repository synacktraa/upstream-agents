/**
 * E2E test setup/teardown endpoint.
 *
 * POST: Creates a test user, mints a session JWT, creates N Daytona sandboxes,
 *       and seeds DB scaffold (Repo → Branch → Sandbox). Does NOT create
 *       messages or start agents — the test page's handleSend does that
 *       through the real /api/branches/messages and /api/agent/execute routes.
 *
 * DELETE: Cleans up Daytona sandboxes and DB records created by POST.
 *
 * No GitHub, no GITHUB_PAT, no OAuth required.
 */
import { cookies } from "next/headers"
import { encode } from "next-auth/jwt"
import { Daytona } from "@daytonaio/sdk"
import { prisma } from "@/lib/db/prisma"
import { PATHS } from "@/lib/shared/constants"
import { encrypt } from "@/lib/auth/encryption"

const E2E_USER_ID = "e2e-test-user"
const E2E_USER = { name: "E2E Test", email: "e2e@test.local" }

async function ensureTestUser() {
  const existing = await prisma.user.findUnique({ where: { id: E2E_USER_ID } })
  if (existing) return existing
  return prisma.user.create({
    data: { id: E2E_USER_ID, name: E2E_USER.name, email: E2E_USER.email },
  })
}

async function setSessionCookie() {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("NEXTAUTH_SECRET not set")

  const token = await encode({
    token: { sub: E2E_USER_ID, name: E2E_USER.name, email: E2E_USER.email, picture: null },
    secret,
    maxAge: 60 * 60,
  })

  const cookieStore = await cookies()
  cookieStore.set("__Secure-next-auth.session-token", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60,
  })
  cookieStore.set("next-auth.session-token", token, {
    httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 60 * 60,
  })
}

/**
 * Remove all repos/branches/sandboxes for the E2E user and delete Daytona VMs.
 * Needed so /api/user/me (top-N repos) still includes the repo the test navigates to,
 * and so we never auto-select an old branch stuck in "running" without an execution.
 */
async function wipeE2eUserData(daytona: Daytona) {
  const rows = await prisma.sandbox.findMany({
    where: { userId: E2E_USER_ID },
    select: { sandboxId: true },
  })
  for (const { sandboxId } of rows) {
    try {
      const s = await daytona.get(sandboxId)
      await s.delete()
    } catch {
      /* best effort */
    }
  }

  const repos = await prisma.repo.findMany({
    where: { userId: E2E_USER_ID },
    select: { id: true },
  })
  const repoIds = repos.map((r) => r.id)

  if (repoIds.length === 0) return

  const branchIds = (
    await prisma.branch.findMany({
      where: { repoId: { in: repoIds } },
      select: { id: true },
    })
  ).map((b) => b.id)

  if (branchIds.length > 0) {
    const messageIds = (
      await prisma.message.findMany({
        where: { branchId: { in: branchIds } },
        select: { id: true },
      })
    ).map((m) => m.id)

    if (messageIds.length > 0) {
      await prisma.agentExecution.deleteMany({ where: { messageId: { in: messageIds } } })
      await prisma.message.deleteMany({ where: { id: { in: messageIds } } })
    }
    await prisma.sandbox.deleteMany({ where: { branchId: { in: branchIds } } })
    await prisma.branch.deleteMany({ where: { id: { in: branchIds } } })
  }
  await prisma.repo.deleteMany({ where: { id: { in: repoIds } } })
}

/**
 * When `E2E_CLAUDE_OAUTH_JSON` is set (e.g. in `.env.e2e`), seed the e2e user with the same
 * Claude Max OAuth blob used in Settings (JSON with `claudeAiOauth`, etc.). Enables real
 * `claude-code` runs in Playwright without OpenCode.
 */
async function upsertE2eClaudeOAuthFromEnv() {
  const raw = process.env.E2E_CLAUDE_OAUTH_JSON?.trim()
  if (!raw) return

  let normalized: string
  try {
    normalized = JSON.stringify(JSON.parse(raw))
  } catch {
    console.warn("[e2e/setup] E2E_CLAUDE_OAUTH_JSON is not valid JSON, skipping Claude credentials")
    return
  }

  await prisma.userCredentials.upsert({
    where: { userId: E2E_USER_ID },
    create: {
      userId: E2E_USER_ID,
      anthropicAuthType: "claude-max",
      anthropicAuthToken: encrypt(normalized),
    },
    update: {
      anthropicAuthType: "claude-max",
      anthropicAuthToken: encrypt(normalized),
    },
  })
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 404 })
  }

  const body = await req.json()
  const count: number = body.count ?? 3
  const singleRepo: boolean = body.singleRepo ?? false

  const daytonaApiKey = process.env.DAYTONA_API_KEY
  if (!daytonaApiKey) {
    return Response.json({ error: "DAYTONA_API_KEY not set" }, { status: 500 })
  }

  try {
    // 1. Test user + wipe previous E2E rows so /api/user/me includes the new repo (see wipeE2eUserData).
    await ensureTestUser()
    const daytona = new Daytona({ apiKey: daytonaApiKey })
    await wipeE2eUserData(daytona)
    await upsertE2eClaudeOAuthFromEnv()
    await setSessionCookie()

    const e2eAgent = process.env.E2E_CLAUDE_OAUTH_JSON?.trim() ? "claude-code" : "opencode"

    // 2. Create Daytona sandboxes concurrently
    const sandboxes = await Promise.all(
      Array.from({ length: count }, () => daytona.create())
    )

    // 3. Seed DB scaffold: Repo → Branch → Sandbox (no messages, no executions)
    //    singleRepo=true puts all branches under one repo (for multi-agent UI tests)
    const branches: Array<{
      branchId: string
      sandboxId: string
      repoName: string
    }> = []

    const sharedRepoName = `e2e-repo-${Date.now()}`
    let sharedRepo: { id: string } | null = null

    if (singleRepo) {
      // Create one repo and one working directory per sandbox
      sharedRepo = await prisma.repo.create({
        data: {
          userId: E2E_USER_ID,
          owner: "e2e-test",
          name: sharedRepoName,
          defaultBranch: "main",
        },
      })
      await Promise.all(
        sandboxes.map(s => s.process.executeCommand(`mkdir -p ${PATHS.SANDBOX_HOME}/${sharedRepoName}`))
      )
    }

    for (let i = 0; i < count; i++) {
      const sandbox = sandboxes[i]
      const repoName = singleRepo ? sharedRepoName : `${sharedRepoName}-${i}`

      if (!singleRepo) {
        await sandbox.process.executeCommand(`mkdir -p ${PATHS.SANDBOX_HOME}/${repoName}`)
      }

      const repo = singleRepo
        ? sharedRepo!
        : await prisma.repo.create({
            data: {
              userId: E2E_USER_ID,
              owner: "e2e-test",
              name: repoName,
              defaultBranch: "main",
            },
          })

      const branch = await prisma.branch.create({
        data: {
          repoId: repo.id,
          name: `e2e-branch-${i}`,
          baseBranch: "main",
          status: "idle",
          agent: e2eAgent,
        },
      })

      await prisma.sandbox.create({
        data: {
          sandboxId: sandbox.id,
          sandboxName: `e2e-sandbox-${i}`,
          userId: E2E_USER_ID,
          branchId: branch.id,
          status: "idle",
        },
      })

      branches.push({
        branchId: branch.id,
        sandboxId: sandbox.id,
        repoName,
      })
    }

    return Response.json({ branches })
  } catch (error) {
    console.error("[e2e/setup] Error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 404 })
  }

  await req.json().catch(() => ({}))

  const daytonaApiKey = process.env.DAYTONA_API_KEY
  if (!daytonaApiKey) {
    return Response.json({ error: "DAYTONA_API_KEY not set" }, { status: 500 })
  }

  try {
    const daytona = new Daytona({ apiKey: daytonaApiKey })
    await wipeE2eUserData(daytona)
  } catch (err) {
    console.error("[e2e/setup] Cleanup error:", err)
  }

  return Response.json({ ok: true })
}
