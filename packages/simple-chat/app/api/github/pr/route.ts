import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { compareBranches, createPullRequest, isGitHubApiError } from "@upstream/common"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { owner, repo, head, base } = body

  if (!owner || !repo || !head || !base) {
    return Response.json({ error: "Missing required fields: owner, repo, head, base" }, { status: 400 })
  }

  try {
    // Get commits between base and head for PR body
    let commitMessages: string[] = []
    try {
      const compareData = await compareBranches(session.accessToken, owner, repo, base, head)
      const commits = compareData.commits || []
      if (commits.length > 0) {
        commitMessages = commits.map((c) => c.commit.message)
      }
    } catch {
      // Ignore compare errors, just use empty commits
    }

    // Generate simple PR title from branch name
    const title = head
      .replace(/^(feat|fix|refactor|docs|test|chore)\//, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase())

    // Generate simple PR body from commit messages
    const prBody = commitMessages.length > 0
      ? commitMessages.map((c) => `- ${c}`).join("\n")
      : "Automated PR"

    // Create the PR
    const prData = await createPullRequest(session.accessToken, owner, repo, {
      title,
      body: prBody,
      head,
      base,
    })

    return Response.json({
      url: prData.html_url,
      number: prData.number,
      title: prData.title,
    })
  } catch (error: unknown) {
    console.error("[github/pr] Error:", error)
    if (isGitHubApiError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
