/**
 * Stream Integrity Tests
 *
 * Verify that streamed content arrives complete and renders correctly.
 * These tests catch issues like empty bubbles, dropped chunks, or
 * incomplete tool call rendering.
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
  expect,
} from "../fixtures/agent-fixture"
import { TIMEOUT } from "../fixtures/timeouts"

const PROMPT =
  "Create a file called test.txt containing 'Stream test'. Then reply with a short confirmation."

const test = agentTest({ count: 1 })

test.describe("stream integrity", () => {
  test("no empty prose blocks after completion", async ({ page, branches, repoName }) => {
    await navigateToRepo(page, repoName)
    await selectBranch(page, 0)
    await sendMessage(page, PROMPT)
    await expectAgentWorking(page)
    await waitForAgentComplete(page)

    // Find all prose blocks and verify none are empty
    const proseBlocks = page.locator('[class*="prose"]')
    const count = await proseBlocks.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const text = await proseBlocks.nth(i).textContent()
      expect(text?.trim().length, `prose block ${i} should not be empty`).toBeGreaterThan(0)
    }
  })

  test("no empty tool call blocks after completion", async ({ page, branches, repoName }) => {
    await navigateToRepo(page, repoName)
    await selectBranch(page, 0)
    await sendMessage(page, PROMPT)
    await expectAgentWorking(page)
    await expectToolCalls(page)
    await waitForAgentComplete(page)

    // Tool calls should have visible content (tool name at minimum)
    const toolCalls = page.locator("text=/Write|Bash|Read|Edit|Glob|Grep/i")
    const count = await toolCalls.count()
    expect(count, "should have at least one tool call").toBeGreaterThan(0)
  })

  test("user message renders completely", async ({ page, branches, repoName }) => {
    await navigateToRepo(page, repoName)
    await selectBranch(page, 0)
    await sendMessage(page, PROMPT)

    // User message should appear with full content (check first 40 chars)
    await expect(page.locator(`text=${PROMPT.slice(0, 40)}`)).toBeVisible({
      timeout: TIMEOUT.UI_READY,
    })
  })

  test("content blocks have non-zero height", async ({ page, branches, repoName }) => {
    await navigateToRepo(page, repoName)
    await selectBranch(page, 0)
    await sendMessage(page, PROMPT)
    await expectAgentWorking(page)
    await waitForAgentComplete(page)
    await expectProseContent(page)

    // Check that prose blocks are actually rendered (not 0-height)
    const proseBlocks = page.locator('[class*="prose"]')
    const count = await proseBlocks.count()

    for (let i = 0; i < count; i++) {
      const box = await proseBlocks.nth(i).boundingBox()
      expect(box, `prose block ${i} should have a bounding box`).not.toBeNull()
      expect(box!.height, `prose block ${i} should have height > 0`).toBeGreaterThan(0)
    }
  })
})
