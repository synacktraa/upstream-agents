/**
 * Real app E2E: 3 agents running concurrently under one repo.
 *
 * Sends a message on each branch, waits for all to complete,
 * verifies content on each, then refreshes and re-verifies.
 */
import {
  agentTest,
  navigateToRepo,
  selectBranch,
  sendMessage,
  expectAgentWorking,
  expectProseContent,
  expectNotWorking,
  waitForCompletionViaAPI,
  expect,
} from "../fixtures/agent-fixture"

const AGENT_COUNT = 3

const PROMPTS = [
  "Create a file called hello0.txt with 'Hello from branch 0'. Reply ONLY 'Done 0'.",
  "Create a file called hello1.txt with 'Hello from branch 1'. Reply ONLY 'Done 1'.",
  "Create a file called hello2.txt with 'Hello from branch 2'. Reply ONLY 'Done 2'.",
]

const test = agentTest({ count: AGENT_COUNT, singleRepo: true })

test("3 concurrent agents: send, stream, complete, refresh", async ({
  page,
  branches,
  repoName,
}) => {
  await test.step("navigate to repo", async () => {
    await navigateToRepo(page, repoName)
    for (let i = 0; i < AGENT_COUNT; i++) {
      await expect(
        page.getByRole("button", { name: new RegExp(`e2e-branch-${i}`) })
      ).toBeVisible({ timeout: 15_000 })
    }
  })

  await test.step("send message on each branch", async () => {
    for (let i = 0; i < AGENT_COUNT; i++) {
      await selectBranch(page, i)
      await page.waitForTimeout(500)
      await sendMessage(page, PROMPTS[i])
      await expectAgentWorking(page)
    }
  })

  await test.step("all agents complete (via API)", async () => {
    for (const b of branches) {
      await waitForCompletionViaAPI(page, b.branchId)
    }
  })

  await test.step("each branch has content and is idle", async () => {
    for (let i = 0; i < AGENT_COUNT; i++) {
      await selectBranch(page, i)
      await page.waitForTimeout(1000)
      await expect(page.locator(`text=${PROMPTS[i].slice(0, 20)}`)).toBeVisible({
        timeout: 10_000,
      })
      await expectProseContent(page, 10_000)
      await expectNotWorking(page)
    }
  })

  await test.step("refresh preserves all branches", async () => {
    await page.reload()
    await navigateToRepo(page, repoName)

    for (let i = 0; i < AGENT_COUNT; i++) {
      await selectBranch(page, i)
      await page.waitForTimeout(1000)
      await expectProseContent(page, 10_000)
      await expectNotWorking(page)
    }
  })
})
