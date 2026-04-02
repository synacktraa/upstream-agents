/**
 * Debug logging utility for the watcher SDK
 */

const DEBUG_ENV_VAR = "WATCHER_DEBUG";

/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled(): boolean {
  return process.env[DEBUG_ENV_VAR] === "1" || process.env[DEBUG_ENV_VAR] === "true";
}

/**
 * Log a debug message if debug mode is enabled
 */
export function debugLog(message: string, ...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log(`[watcher] ${message}`, ...args);
  }
}
