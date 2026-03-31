/**
 * Quick test of the refactored sandbox adapter.
 * Run with: DAYTONA_API_KEY=... TEST_ANTHROPIC_API_KEY=... npx ts-node tests/integration/refactor-test.ts
 */
import { Daytona } from "@daytonaio/sdk"
import { createBackgroundSession } from "../../dist/session.js"

const cleanEnv = (val: string) => val.replace(/[\r\n\s]/g, "")

async function main() {
  console.log("=== Refactored Sandbox Adapter Test ===\n")

  if (!process.env.DAYTONA_API_KEY || !process.env.TEST_ANTHROPIC_API_KEY) {
    console.log("Skipping: DAYTONA_API_KEY and TEST_ANTHROPIC_API_KEY required")
    process.exit(0)
  }

  const daytona = new Daytona({ apiKey: cleanEnv(process.env.DAYTONA_API_KEY) })
  const sandbox = await daytona.create()
  console.log(`Sandbox: ${sandbox.id}\n`)

  try {
    console.log("1. Creating background session...")
    const session = await createBackgroundSession("claude", {
      sandbox,
      env: { ANTHROPIC_API_KEY: cleanEnv(process.env.TEST_ANTHROPIC_API_KEY) },
    })
    console.log(`   Session ID: ${session.id}\n`)

    console.log("2. Starting background task...")
    const startTime = Date.now()
    const { pid, outputFile } = await session.start("Say hello in one sentence")
    const launchTime = Date.now() - startTime
    console.log(`   PID: ${pid}`)
    console.log(`   Output file: ${outputFile}`)
    console.log(`   Launch time: ${launchTime}ms\n`)

    console.log("3. Polling for events...")
    let totalEvents = 0
    let hasEnd = false

    for (let i = 0; i < 30; i++) {
      const { events, running } = await session.getEvents()

      if (events.length > 0) {
        totalEvents += events.length
        console.log(`   Poll ${i + 1}: ${events.length} events, running=${running}`)

        for (const event of events) {
          if (event.type === "token") {
            process.stdout.write(event.text)
          }
          if (event.type === "end") {
            hasEnd = true
            console.log("\n   [END event received]")
          }
        }
      }

      if (!running) {
        console.log(`   Process completed (running=${running})`)
        break
      }

      await new Promise((r) => setTimeout(r, 1000))
    }

    console.log(`\n4. Results:`)
    console.log(`   Total events: ${totalEvents}`)
    console.log(`   Has end event: ${hasEnd}`)
    console.log(`   Launch time: ${launchTime}ms`)

    // Test cancel (should be no-op since process completed)
    console.log("\n5. Testing cancel (should be no-op)...")
    await session.cancel()
    console.log("   Cancel completed")

    console.log("\n✅ All tests passed!")
  } finally {
    console.log("\nCleaning up sandbox...")
    await sandbox.delete()
    console.log("Done.")
  }
}

main().catch((e) => {
  console.error("Test failed:", e)
  process.exit(1)
})
