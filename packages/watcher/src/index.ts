/**
 * @upstream/watcher - File watcher SDK for Daytona sandboxes
 *
 * A simple SDK for monitoring file changes in a sandbox directory.
 * Query for recently modified files and read their contents on demand.
 *
 * @example
 * ```typescript
 * import { createWatcher } from "@upstream/watcher";
 * import { Daytona } from "@daytonaio/sdk";
 *
 * const daytona = new Daytona();
 * const sandbox = await daytona.create();
 *
 * const watcher = createWatcher(sandbox, {
 *   path: "/home/daytona/project/src",
 *   extensions: [".ts", ".tsx"],
 * });
 *
 * // Get files modified in the last 30 seconds
 * const { files } = await watcher.getModifiedFiles({ since: 30 });
 *
 * // Read content of modified files
 * for (const file of files) {
 *   const { content } = await watcher.readFile(file.path);
 *   console.log(`${file.path}:\n${content}`);
 * }
 * ```
 */

import type { Sandbox } from "@daytonaio/sdk";
import type { FileWatcher, WatcherSandbox } from "./core/watcher.js";
import type { WatcherOptions } from "./types/options.js";
import { createFileWatcher } from "./watcher.js";
import { adaptSandbox } from "./sandbox/index.js";

// Re-export types
export type {
  FileWatcher,
  WatcherSandbox,
  FileWatcherConfig,
} from "./core/watcher.js";

export type {
  ModifiedFile,
  ModifiedFilesResult,
  FileContent,
} from "./types/events.js";

export type {
  WatcherOptions,
  GetModifiedFilesOptions,
  ReadFileOptions,
} from "./types/options.js";

// Re-export sandbox adapters
export { adaptSandbox, adaptDaytonaSandbox } from "./sandbox/index.js";

// Re-export debug utilities
export { isDebugEnabled, debugLog } from "./debug.js";

/**
 * Create a file watcher for a sandbox
 *
 * @param sandbox - Daytona Sandbox or WatcherSandbox implementation
 * @param options - Watcher configuration options
 * @returns A FileWatcher instance
 *
 * @example
 * ```typescript
 * const watcher = createWatcher(sandbox, {
 *   path: "/home/daytona/project/src",
 *   extensions: [".ts", ".tsx", ".js"],
 *   ignore: ["node_modules", ".git", "dist"],
 * });
 * ```
 */
export function createWatcher(
  sandbox: Sandbox | WatcherSandbox,
  options: WatcherOptions
): FileWatcher {
  const adaptedSandbox = adaptSandbox(sandbox);

  return createFileWatcher({
    ...options,
    sandbox: adaptedSandbox,
  });
}
