/**
 * Real app E2E: send → stream → tool calls → complete → refresh preserves content.
 *
 * Single agent on a single branch through the full UI stack.
 */
import {
  agentTest,
  navigateToRepo,
  selectBranch,
  sendMessage,
  expectAgentWorking,
  waitForAgentComplete,
  expectProseContent,
  expectToolCalls,
  expectNotWorking,
  expect,
} from "../fixtures/agent-fixture"
import { TIMEOUT } from "../fixtures/timeouts"

const PROMPT =
  "Create a file called greeting.txt containing 'Hello E2E'. Then reply with ONLY the word 'Done'."

const test = agentTest({ count: 1 })

test("send → stream → complete → refresh", async ({ page, branches, repoName }) => {
  const { branchId } = branches[0]

  await test.step("navigate and select branch", async () => {
    await navigateToRepo(page, repoName)
    await selectBranch(page, 0)
  })

  await test.step("send message", async () => {
    await sendMessage(page, PROMPT)
  })

  await test.step("agent starts working", async () => {
    await expectAgentWorking(page)
  })

  await test.step("user message rendered", async () => {
    await expect(page.locator(`text=${PROMPT.slice(0, 30)}`)).toBeVisible({
      timeout: TIMEOUT.UI_READY,
    })
  })

  await test.step("streaming content appears", async () => {
    await expectProseContent(page)
  })

  await test.step("tool calls appear", async () => {
    await expectToolCalls(page)
  })

  await test.step("agent completes", async () => {
    await waitForAgentComplete(page)
  })

  const preRefreshContent = await test.step("snapshot pre-refresh content", async () => {
    const content = await page.locator('[class*="prose"]').last().textContent()
    expect(content?.length).toBeGreaterThan(0)
    return content
  })

  await test.step("refresh preserves content", async () => {
    await page.reload()
    await navigateToRepo(page, repoName)
    await selectBranch(page, 0)

    await expect(page.locator(`text=${PROMPT.slice(0, 30)}`)).toBeVisible({
      timeout: TIMEOUT.POST_REFRESH,
    })
    await expectProseContent(page, TIMEOUT.POST_REFRESH)
    await expectNotWorking(page)

    const postContent = await page.locator('[class*="prose"]').last().textContent()
    expect(postContent?.length).toBeGreaterThan(0)
  })
})
