/**
 * Test: Run Codex in background using SSH
 *
 * This method uses SSH to launch the process with nohup, which returns immediately.
 * The process runs detached from the SSH session, and we poll a file for results.
 *
 * RESULT: This works for true async - SSH returns immediately with PID.
 */

import { Daytona } from "@daytonaio/sdk"
import { Client } from "ssh2"

const SSH_HOST = "ssh.app.daytona.io"
const SSH_PORT = 22

// Clean API key (remove hidden chars like \r)
const cleanEnv = (val: string) => val.replace(/[\r\n\s]/g, "")

async function main() {
  console.log("=== SSH Background Method ===\n")

  // 1. Create sandbox
  console.log("1. Creating sandbox...")
  const daytona = new Daytona({ apiKey: cleanEnv(process.env.DAYTONA_API_KEY!) })
  const sandbox = await daytona.create({
    envVars: { OPENAI_API_KEY: cleanEnv(process.env.OPENAI_API_KEY!) },
  })
  console.log(`   Sandbox created: ${sandbox.id}\n`)

  try {
    // 2. Install codex CLI
    console.log("2. Installing codex CLI...")
    await sandbox.process.executeCommand("npm install -g @openai/codex", undefined, undefined, 120)
    console.log("   Codex installed.\n")

    // 3. Get SSH access for background execution
    console.log("3. Establishing SSH connection...")
    const { token } = await sandbox.createSshAccess(60)
    const ssh = new Client()
    await new Promise<void>((resolve, reject) => {
      ssh.on("ready", resolve)
      ssh.on("error", reject)
      ssh.connect({ host: SSH_HOST, port: SSH_PORT, username: token })
    })
    console.log("   SSH connected.\n")

    // 4. Start codex in background via SSH (returns immediately)
    console.log("4. Starting Codex in background...")
    const outputFile = "/tmp/codex-output.jsonl"
    const prompt = "Write a hello world Python script and run it"
    const apiKey = cleanEnv(process.env.OPENAI_API_KEY!).replace(/'/g, "'\\''")
    const command = `OPENAI_API_KEY='${apiKey}' codex exec --json --skip-git-repo-check --yolo "${prompt}"`
    const safeCmd = command.replace(/'/g, "'\\''")
    const wrapper = `nohup sh -c '${safeCmd} >> ${outputFile} 2>&1; echo 1 > ${outputFile}.done' > /dev/null 2>&1 & echo $!`

    const startTime = Date.now()
    const pid = await new Promise<number>((resolve, reject) => {
      ssh.exec(wrapper, (err, stream) => {
        if (err) return reject(err)
        let output = ""
        stream.on("data", (data: Buffer) => (output += data.toString()))
        stream.on("close", () => resolve(parseInt(output.trim())))
      })
    })
    const launchTime = Date.now() - startTime
    console.log(`   Started with PID: ${pid}`)
    console.log(`   Launch returned in ${launchTime}ms (should be < 1000ms for true async)\n`)

    // 5. Simulate "coming back later" - disconnect SSH, wait, then poll
    console.log("5. Simulating disconnect (closing SSH)...")
    ssh.end()
    console.log("   SSH disconnected. Process should still be running.\n")

    console.log("6. Waiting 2 seconds to simulate coming back later...\n")
    await new Promise((r) => setTimeout(r, 2000))

    // 7. Poll the output file for raw JSON (using process API, no SSH needed)
    console.log("7. Polling for results...")
    let cursor = 0
    let pollCount = 0
    while (pollCount < 120) {
      // 60 second timeout
      pollCount++
      const result = await sandbox.process.executeCommand(`cat ${outputFile} 2>/dev/null || true`)
      const content = result.result || ""

      // Print new lines since last poll
      const newContent = content.slice(cursor)
      if (newContent) {
        process.stdout.write(newContent)
        cursor = content.length
      }

      // Check if done
      const doneCheck = await sandbox.process.executeCommand(
        `test -f ${outputFile}.done && echo done || echo running`
      )
      if (doneCheck.result?.trim() === "done") {
        console.log("\n\n   Process completed!")
        break
      }

      await new Promise((r) => setTimeout(r, 500))
    }

    console.log("\n=== SSH Method Complete ===")
    console.log(`Launch time: ${launchTime}ms`)
    console.log("Verdict: SSH with nohup provides TRUE async - returns immediately with PID")
  } finally {
    // Cleanup
    console.log("\nCleaning up sandbox...")
    await sandbox.delete()
    console.log("Done.")
  }
}

main().catch(console.error)
