import type { Sandbox } from "@daytonaio/sdk";
import type { WatcherSandbox } from "../core/watcher.js";
import { adaptDaytonaSandbox } from "./daytona.js";

/**
 * Check if an object is a Daytona Sandbox
 */
function isDaytonaSandbox(obj: unknown): obj is Sandbox {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "process" in obj &&
    typeof (obj as Sandbox).process?.executeCommand === "function"
  );
}

/**
 * Adapt a sandbox to the WatcherSandbox interface.
 * Automatically detects Daytona Sandbox vs custom implementation.
 */
export function adaptSandbox(sandbox: Sandbox | WatcherSandbox): WatcherSandbox {
  if (isDaytonaSandbox(sandbox)) {
    return adaptDaytonaSandbox(sandbox);
  }
  // Already a WatcherSandbox
  return sandbox as WatcherSandbox;
}

export { adaptDaytonaSandbox } from "./daytona.js";
