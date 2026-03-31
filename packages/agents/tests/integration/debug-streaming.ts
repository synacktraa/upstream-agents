/**
 * Debug test for streaming mode (PTY-based).
 */
import { Daytona } from "@daytonaio/sdk"
import { createSession } from "../../dist/session.js"

const cleanEnv = (val: string) => val.replace(/[\r\n\s]/g, "")

async function main() {
  console.log("=== Debug Streaming Mode ===\n")

  if (!process.env.DAYTONA_API_KEY || !process.env.TEST_ANTHROPIC_API_KEY) {
    console.log("Skipping: DAYTONA_API_KEY and TEST_ANTHROPIC_API_KEY required")
    process.exit(0)
  }

  const daytona = new Daytona({ apiKey: cleanEnv(process.env.DAYTONA_API_KEY) })
  const sandbox = await daytona.create()
  console.log(`Sandbox: ${sandbox.id}\n`)

  try {
    console.log("1. Creating streaming session...")
    const session = await createSession("claude", {
      sandbox,
      env: { ANTHROPIC_API_KEY: cleanEnv(process.env.TEST_ANTHROPIC_API_KEY) },
    })
    console.log("   Done\n")

    console.log("2. Running with streaming (PTY)...")
    let eventCount = 0
    let tokenText = ""

    for await (const event of session.run("say hello in one word")) {
      eventCount++
      console.log(`   Event ${eventCount}: type=${event.type}`)

      if (event.type === "token") {
        tokenText += event.text
        process.stdout.write(event.text)
      }
      if (event.type === "end") {
        console.log("\n   [END]")
      }
    }

    console.log(`\n3. Results:`)
    console.log(`   Total events: ${eventCount}`)
    console.log(`   Token text: "${tokenText}"`)

    if (eventCount === 0) {
      console.log("\n❌ No events received!")
    } else {
      console.log("\n✅ Streaming works!")
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
