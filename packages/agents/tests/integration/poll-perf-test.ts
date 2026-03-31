/**
 * Performance test: verify optimized polling reduces round trips.
 * Run with: DAYTONA_API_KEY=... TEST_ANTHROPIC_API_KEY=... npx ts-node tests/integration/poll-perf-test.ts
 */
import { Daytona } from "@daytonaio/sdk"
import { createBackgroundSession } from "../../dist/session.js"

const cleanEnv = (val: string) => val.replace(/[\r\n\s]/g, "")

async function main() {
  console.log("=== Poll Performance Test ===\n")

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
    const { pid, outputFile } = await session.start("Count from 1 to 5, one number per line.")
    console.log(`   PID: ${pid}`)
    console.log(`   Output file: ${outputFile}\n`)

    console.log("3. Polling with timing...")
    const pollTimes: number[] = []
    let totalEvents = 0
    let hasEnd = false

    for (let i = 0; i < 30; i++) {
      const pollStart = Date.now()
      const { events, running } = await session.getEvents()
      const pollTime = Date.now() - pollStart
      pollTimes.push(pollTime)

      if (events.length > 0) {
        totalEvents += events.length
        console.log(`   Poll ${i + 1}: ${pollTime}ms, ${events.length} events, running=${running}`)

        for (const event of events) {
          if (event.type === "token") {
            process.stdout.write(event.text)
          }
          if (event.type === "end") {
            hasEnd = true
            console.log("\n   [END]")
          }
        }
      } else {
        console.log(`   Poll ${i + 1}: ${pollTime}ms, 0 events, running=${running}`)
      }

      if (!running) {
        console.log(`   Process completed`)
        break
      }

      await new Promise((r) => setTimeout(r, 500))
    }

    console.log(`\n4. Results:`)
    console.log(`   Total events: ${totalEvents}`)
    console.log(`   Has end event: ${hasEnd}`)
    console.log(`   Poll count: ${pollTimes.length}`)

    const avgPollTime = pollTimes.reduce((a, b) => a + b, 0) / pollTimes.length
    const minPollTime = Math.min(...pollTimes)
    const maxPollTime = Math.max(...pollTimes)

    console.log(`   Poll times: avg=${avgPollTime.toFixed(0)}ms, min=${minPollTime}ms, max=${maxPollTime}ms`)

    if (avgPollTime < 300) {
      console.log("\n✅ Optimized polling is working! (avg < 300ms)")
    } else {
      console.log("\n⚠️  Poll times higher than expected (avg > 300ms)")
    }

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
