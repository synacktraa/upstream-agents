/**
 * Options for creating a watcher
 */
export interface WatcherOptions {
  /** Directory path to watch (absolute path in sandbox) */
  path: string;
  /** File extensions to include (e.g., ['.ts', '.tsx', '.js']) */
  extensions?: string[];
  /** Patterns to ignore (e.g., ['node_modules', '.git']) */
  ignore?: string[];
}

/**
 * Options for querying modified files
 */
export interface GetModifiedFilesOptions {
  /** Get files modified within the last N seconds */
  since: number;
}

/**
 * Options for reading file content
 */
export interface ReadFileOptions {
  /** Maximum file size in bytes to read (default: 1MB) */
  maxSize?: number;
}
