/**
 * Daytona sandbox adapter for the file watcher.
 * Wraps a Sandbox from @daytonaio/sdk into WatcherSandbox interface.
 */
import type { Sandbox } from "@daytonaio/sdk";
import type { WatcherSandbox } from "../core/watcher.js";

/** Escape a string for use in single-quoted shell strings */
function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''");
}

/**
 * Adapt a Daytona Sandbox to the WatcherSandbox interface
 */
export function adaptDaytonaSandbox(sandbox: Sandbox): WatcherSandbox {
  return {
    async executeCommand(command: string): Promise<string> {
      const result = await sandbox.process.executeCommand(command, undefined, undefined, 60);
      if (result.exitCode !== 0) {
        throw new Error(`Command failed with exit code ${result.exitCode}: ${result.result ?? ""}`);
      }
      return result.result ?? "";
    },

    async readFile(path: string): Promise<string> {
      const safePath = escapeShell(path);
      const result = await sandbox.process.executeCommand(
        `cat '${safePath}'`,
        undefined,
        undefined,
        30
      );
      if (result.exitCode !== 0) {
        throw new Error(`Failed to read file: ${path}`);
      }
      return result.result ?? "";
    },
  };
}
