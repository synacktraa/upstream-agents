/**
 * Daytona sandbox adapter: wraps a Sandbox from @daytonaio/sdk into CodeAgentSandbox.
 *
 * Background execution uses executeCommand + nohup (simple, fast, no dependencies).
 * Streaming uses PTY for real-time output.
 */
import type { Sandbox } from "@daytonaio/sdk"
import type { CodeAgentSandbox, AdaptSandboxOptions, ExecuteBackgroundOptions, ProviderName } from "../types/index.js"
import { getPackageName } from "../utils/install.js"

/** Strip ANSI escape codes from text */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[()][AB012]|\x1b\[[\?]?[0-9;]*[hlm]|\r/g, "")
}

/** Check if a line looks like JSON */
function isJsonLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith("{") && trimmed.endsWith("}")
}

/** Escape a string for use in single-quoted shell strings */
function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''")
}

/** Build environment variable prefix for shell commands */
function buildEnvPrefix(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([k, v]) => `${k}='${escapeShell(v)}'`)
    .join(" ")
}

export function adaptDaytonaSandbox(
  sandbox: Sandbox,
  options: AdaptSandboxOptions = {}
): CodeAgentSandbox {
  // Simple single-level environment
  const env: Record<string, string> = { ...options.env }

  /** Check if provider CLI is installed */
  async function isProviderInstalled(name: ProviderName): Promise<boolean> {
    try {
      const result = await sandbox.process.executeCommand(`which ${name}`)
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  /** Install provider CLI via npm */
  async function installProvider(name: ProviderName): Promise<boolean> {
    const packageName = getPackageName(name)
    try {
      const result = await sandbox.process.executeCommand(
        `npm install -g ${packageName}`,
        undefined,
        undefined,
        120
      )
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  /** Execute a command synchronously */
  async function executeCommand(command: string, timeout: number = 60): Promise<{ exitCode: number; output: string }> {
    const envPrefix = buildEnvPrefix(env)
    const fullCommand = envPrefix ? `${envPrefix} ${command}` : command
    const result = await sandbox.process.executeCommand(fullCommand, undefined, undefined, timeout)
    return { exitCode: result.exitCode ?? 0, output: result.result ?? "" }
  }

  /**
   * Execute a command in the background using nohup.
   * Returns immediately with PID. Output goes to outputFile.
   * Creates outputFile.done when command completes.
   */
  async function executeBackground(opts: ExecuteBackgroundOptions): Promise<{ pid: number }> {
    const envPrefix = buildEnvPrefix(env)
    const cmd = envPrefix ? `${envPrefix} ${opts.command}` : opts.command
    const safeCmd = escapeShell(cmd)
    const safeOutput = escapeShell(opts.outputFile)
    const doneFile = opts.outputFile + ".done"
    const safeDone = escapeShell(doneFile)

    // nohup wrapper: run command, redirect output, create .done file when complete
    const wrapper = `nohup sh -c '${safeCmd} >> ${safeOutput} 2>&1; echo 1 > ${safeDone}' > /dev/null 2>&1 & echo $!`

    const result = await sandbox.process.executeCommand(wrapper, undefined, undefined, 30)
    const raw = (result.result ?? "").trim().split(/\s+/).pop() ?? ""
    const pid = Number(raw)

    if (!Number.isInteger(pid) || pid < 1) {
      throw new Error(`executeBackground: could not parse pid from: ${result.result?.slice(0, 200)}`)
    }

    return { pid }
  }

  /**
   * Check if a process is actually running (not zombie or dead).
   * Uses ps -o state instead of kill -0 (which lies about zombies).
   */
  async function isProcessRunning(pid: number): Promise<boolean> {
    const result = await sandbox.process.executeCommand(
      `ps -p ${pid} -o state= 2>/dev/null || echo X`
    )
    const state = result.result?.trim() || "X"
    // R=running, S=sleeping, D=disk sleep - these are "alive"
    // Z=zombie, X=dead, ""=not found - these are "dead"
    return state !== "Z" && state !== "X" && state !== ""
  }

  /**
   * Kill a background process robustly.
   * Tries SIGTERM, then SIGKILL, then pkill as last resort.
   */
  async function killBackgroundProcess(pid: number, processName?: string): Promise<void> {
    // Step 1: Graceful SIGTERM
    await sandbox.process.executeCommand(`kill -TERM ${pid} 2>/dev/null || true`)

    // Brief wait for graceful shutdown
    await new Promise(r => setTimeout(r, 500))

    // Step 2: Check if still running, force kill if needed
    if (await isProcessRunning(pid)) {
      await sandbox.process.executeCommand(`kill -9 ${pid} 2>/dev/null || true`)
      await new Promise(r => setTimeout(r, 300))
    }

    // Step 3: Also try process group kill
    await sandbox.process.executeCommand(`kill -9 -${pid} 2>/dev/null || true`)

    // Step 4: Last resort - pkill by name if provided
    if (processName) {
      await sandbox.process.executeCommand(`pkill -9 -f "${escapeShell(processName)}" 2>/dev/null || true`)
    }
  }

  return {
    // Environment management (simplified - single level)
    setEnvVars(vars: Record<string, string>): void {
      Object.assign(env, vars)
    },

    setSessionEnvVars(vars: Record<string, string>): void {
      Object.assign(env, vars)
    },

    setRunEnvVars(vars: Record<string, string>): void {
      Object.assign(env, vars)
    },

    clearRunEnvVars(): void {
      // No-op in simplified model - env persists
      // If caller wants fresh env, they should create new adapter
    },

    executeCommand,
    executeBackground,
    killBackgroundProcess,
    isProcessRunning,

    async ensureProvider(name: ProviderName): Promise<void> {
      const installed = await isProviderInstalled(name)
      if (!installed) {
        console.log(`Installing ${name} CLI in sandbox...`)
        const success = await installProvider(name)
        if (!success) {
          throw new Error(`Failed to install ${name} CLI in sandbox`)
        }
        console.log(`Installed ${name} CLI`)

        // Post-install setup for Gemini
        if (name === "gemini") {
          await sandbox.process.executeCommand("mkdir -p ~/.gemini", undefined, undefined, 30)
        }
      }
    },

    /**
     * Stream command output via PTY.
     * Yields JSON lines as they arrive.
     */
    async *executeCommandStream(
      command: string,
      timeout: number = 120
    ): AsyncGenerator<string, void, unknown> {
      const envExports = Object.entries(env)
        .map(([k, v]) => `export ${k}='${escapeShell(v)}'`)
        .join("; ")
      const timedCommand = timeout > 0 ? `timeout ${timeout}s ${command}` : command
      const fullCommand = envExports ? `${envExports}; ${timedCommand}` : timedCommand

      let buffer = ""
      const lineQueue: string[] = []
      let resolveNext: ((value: IteratorResult<string, void>) => void) | null = null
      let ptyDone = false

      const ptyId = `pty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const ptyHandle = await sandbox.process.createPty({
        id: ptyId,
        onData: (data: Uint8Array) => {
          const text = new TextDecoder().decode(data)
          buffer += text
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            const cleaned = stripAnsi(line).trim()
            if (cleaned) {
              if (process.env.CODING_AGENTS_DEBUG) {
                console.error(`[sandbox-stream] ${cleaned.substring(0, 200)}`)
              }
              if (isJsonLine(cleaned)) {
                if (resolveNext) {
                  resolveNext({ value: cleaned, done: false })
                  resolveNext = null
                } else {
                  lineQueue.push(cleaned)
                }
              }
            }
          }
        },
      })

      try {
        await ptyHandle.waitForConnection()
        await ptyHandle.sendInput(`${fullCommand}\n`)
        await ptyHandle.sendInput("exit\n")

        const waitPromise = ptyHandle.wait().then(() => {
          ptyDone = true
          const cleaned = stripAnsi(buffer).trim()
          if (cleaned && isJsonLine(cleaned)) {
            if (resolveNext) {
              resolveNext({ value: cleaned, done: false })
              resolveNext = null
            } else {
              lineQueue.push(cleaned)
            }
          }
          if (resolveNext) {
            resolveNext({ value: undefined, done: true })
            resolveNext = null
          }
        })

        while (true) {
          if (lineQueue.length > 0) {
            yield lineQueue.shift()!
          } else if (ptyDone) {
            break
          } else {
            const result = await new Promise<IteratorResult<string, void>>((resolve) => {
              resolveNext = resolve
              if (lineQueue.length > 0) {
                resolve({ value: lineQueue.shift()!, done: false })
                resolveNext = null
              } else if (ptyDone) {
                resolve({ value: undefined, done: true })
                resolveNext = null
              }
            })
            if (result.done) break
            yield result.value
          }
        }

        await waitPromise
      } finally {
        await ptyHandle.disconnect()
      }
    },
  }
}
