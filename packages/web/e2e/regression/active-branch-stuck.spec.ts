/**
 * Regression: agent completes on the active branch but content stays
 * "Thinking..." because cross-device sync overwrote branch.status before
 * the poller delivered the final content.
 *
 * Stays on ONE branch the entire time to isolate the sync-vs-poller race.
 */
import {
  agentTest,
  navigateToRepo,
  selectBranch,
  sendMessage,
  expectAgentWorking,
  waitForAgentComplete,
  expectProseContent,
  expect,
} from "../fixtures/agent-fixture"

const PROMPT = "Create a file called race.txt with 'sync race test'. Reply ONLY 'Done'."

const test = agentTest({ count: 1 })

test("content replaces Thinking... on active branch", async ({ page, repoName }) => {
  await test.step("navigate and select branch", async () => {
    await navigateToRepo(page, repoName)
    await selectBranch(page, 0)
  })

  await test.step("send message and stay on branch", async () => {
    await sendMessage(page, PROMPT)
    await expectAgentWorking(page)
  })

  await test.step("agent completes", async () => {
    await waitForAgentComplete(page)
  })

  await test.step("no Thinking... visible after completion", async () => {
    await page.waitForTimeout(2_000)
    const thinkingVisible = await page.locator("text=Thinking...").isVisible().catch(() => false)
    expect(thinkingVisible).toBe(false)
  })

  await test.step("real content is rendered", async () => {
    await expectProseContent(page, 5_000)
    const content = await page.locator('[class*="prose"]').last().textContent()
    expect(content?.length).toBeGreaterThan(0)
  })
})
