import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  notFound,
} from "@/lib/shared/api-helpers"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  const { repoId } = await params
  if (!repoId) return badRequest("Missing repoId")

  const body = await req.json()

  // Verify ownership
  const repo = await prisma.repo.findUnique({ where: { id: repoId } })
  if (!repo || repo.userId !== auth.userId) {
    return notFound("Repo not found")
  }

  const updateData: Record<string, unknown> = {}

  if (typeof body.preferredBaseBranch === "string") {
    updateData.preferredBaseBranch = body.preferredBaseBranch
  }

  if (Object.keys(updateData).length === 0) {
    return badRequest("No valid fields to update")
  }

  await prisma.repo.update({
    where: { id: repoId },
    data: updateData,
  })

  return Response.json({ success: true })
}
