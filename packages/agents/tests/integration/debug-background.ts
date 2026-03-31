/**
 * Debug test to understand what's happening with background execution.
 */
import { Daytona } from "@daytonaio/sdk"
import { adaptDaytonaSandbox } from "../../dist/sandbox/daytona.js"

const cleanEnv = (val: string) => val.replace(/[\r\n\s]/g, "")

async function main() {
  console.log("=== Debug Background Execution ===\n")

  if (!process.env.DAYTONA_API_KEY || !process.env.TEST_ANTHROPIC_API_KEY) {
    console.log("Skipping: DAYTONA_API_KEY and TEST_ANTHROPIC_API_KEY required")
    process.exit(0)
  }

  const daytona = new Daytona({ apiKey: cleanEnv(process.env.DAYTONA_API_KEY) })
  const sandbox = await daytona.create()
  console.log(`Sandbox: ${sandbox.id}\n`)

  try {
    const apiKey = cleanEnv(process.env.TEST_ANTHROPIC_API_KEY)
    const adapted = adaptDaytonaSandbox(sandbox, { env: { ANTHROPIC_API_KEY: apiKey } })

    // Install claude
    console.log("1. Installing claude...")
    await adapted.ensureProvider("claude")
    console.log("   Done\n")

    // Test executeBackground directly
    const outputFile = "/tmp/debug-test.jsonl"
    const command = `claude --print --output-format stream-json --verbose --dangerously-skip-permissions "say hello in one word"`

    console.log("2. Running executeBackground...")
    console.log(`   Command: ${command.slice(0, 80)}...`)
    console.log(`   Output file: ${outputFile}`)

    const result = await adapted.executeBackground!({
      command,
      outputFile,
      runId: "debug-1",
    })
    console.log(`   PID: ${result.pid}\n`)

    // Check what's in the sandbox
    console.log("3. Checking sandbox state...")

    // Check if process is running
    const isRunning = await adapted.isProcessRunning!(result.pid)
    console.log(`   Process ${result.pid} running: ${isRunning}`)

    // List processes
    const ps = await sandbox.process.executeCommand("ps aux | grep -E 'claude|nohup' | grep -v grep | head -5")
    console.log(`   Processes:\n${ps.result || "   (none)"}\n`)

    // Wait and poll
    console.log("4. Polling output file...")
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000))

      const sizeResult = await sandbox.process.executeCommand(`wc -c < ${outputFile} 2>/dev/null || echo 0`)
      const size = sizeResult.result?.trim() || "0"

      const doneResult = await sandbox.process.executeCommand(`test -f ${outputFile}.done && echo yes || echo no`)
      const done = doneResult.result?.trim() === "yes"

      const running = await adapted.isProcessRunning!(result.pid)

      console.log(`   Poll ${i + 1}: size=${size} bytes, done=${done}, running=${running}`)

      if (done || parseInt(size) > 100) {
        // Show content
        const content = await sandbox.process.executeCommand(`cat ${outputFile} 2>/dev/null | head -20`)
        console.log(`\n5. Output file content:\n${content.result || "(empty)"}\n`)
        break
      }

      if (i === 5) {
        // After 5 seconds, check what's happening
        console.log("\n   --- Debug info after 5s ---")
        const psNow = await sandbox.process.executeCommand("ps aux | head -20")
        console.log(`   All processes:\n${psNow.result}`)

        const envCheck = await sandbox.process.executeCommand("echo ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
        console.log(`   Env: ${envCheck.result}`)
        console.log("   ---\n")
      }
    }

    // Final check
    const finalContent = await sandbox.process.executeCommand(`cat ${outputFile} 2>/dev/null`)
    if (!finalContent.result?.trim()) {
      console.log("❌ No output captured!")

      // Check stderr
      const stderrFile = "/tmp/debug-stderr.txt"
      await sandbox.process.executeCommand(`ANTHROPIC_API_KEY='${apiKey}' claude --print --dangerously-skip-permissions "hi" 2>${stderrFile}; cat ${stderrFile}`, undefined, undefined, 30)
      const stderr = await sandbox.process.executeCommand(`cat ${stderrFile}`)
      console.log(`\nDirect stderr: ${stderr.result}`)
    } else {
      console.log("✅ Output captured successfully")
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
