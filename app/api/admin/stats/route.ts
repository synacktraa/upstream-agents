import { prisma } from "@/lib/prisma"
import { requireAdmin, isAuthError } from "@/lib/api-helpers"
import { BRANCH_STATUS } from "@/lib/constants"

const ACTIVE_STATUSES = [BRANCH_STATUS.CREATING, BRANCH_STATUS.RUNNING, BRANCH_STATUS.STOPPED]

export async function GET() {
  const auth = await requireAdmin()
  if (isAuthError(auth)) return auth

  const activityLog = (prisma as { activityLog?: any }).activityLog

  // Get current date boundaries
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - 7)

  // Run all queries in parallel
  const [
    totalUsers,
    activeSandboxes,
    sandboxesCreatedToday,
    sandboxesCreatedThisWeek,
    agentExecutionsToday,
    agentExecutionsThisWeek,
    recentActivity,
  ] = await Promise.all([
    // Total users
    prisma.user.count(),

    // Currently active sandboxes
    prisma.sandbox.count({
      where: { status: { in: ACTIVE_STATUSES } },
    }),

    // Sandboxes created today (from activity log)
    activityLog
      ? activityLog.count({
          where: {
            action: "sandbox_created",
            createdAt: { gte: startOfToday },
          },
        })
      : Promise.resolve(0),

    // Sandboxes created this week
    activityLog
      ? activityLog.count({
          where: {
            action: "sandbox_created",
            createdAt: { gte: startOfWeek },
          },
        })
      : Promise.resolve(0),

    // Agent executions today
    activityLog
      ? activityLog.count({
          where: {
            action: "agent_executed",
            createdAt: { gte: startOfToday },
          },
        })
      : Promise.resolve(0),

    // Agent executions this week
    activityLog
      ? activityLog.count({
          where: {
            action: "agent_executed",
            createdAt: { gte: startOfWeek },
          },
        })
      : Promise.resolve(0),

    // Recent activity (last 50 entries)
    activityLog
      ? activityLog.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            userId: true,
            action: true,
            metadata: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ])

  return Response.json({
    stats: {
      totalUsers,
      activeSandboxes,
      sandboxesCreatedToday,
      sandboxesCreatedThisWeek,
      agentExecutionsToday,
      agentExecutionsThisWeek,
    },
    recentActivity,
  })
}
