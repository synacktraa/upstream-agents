import type {
  ModifiedFilesResult,
  FileContent,
  WatcherOptions,
  GetModifiedFilesOptions,
  ReadFileOptions,
} from "../types/index.js";

/**
 * Interface for sandbox operations required by the watcher
 */
export interface WatcherSandbox {
  /**
   * Execute a command in the sandbox and return stdout
   */
  executeCommand(command: string): Promise<string>;

  /**
   * Read a file from the sandbox
   */
  readFile(path: string): Promise<string>;
}

/**
 * File watcher interface for monitoring file changes in a sandbox
 */
export interface FileWatcher {
  /** The directory being watched */
  readonly path: string;

  /** File extensions being watched */
  readonly extensions: string[];

  /** Patterns being ignored */
  readonly ignore: string[];

  /**
   * Get files that have been modified within a given time period
   * @param options - Query options including time period
   * @returns List of modified files with metadata
   */
  getModifiedFiles(options: GetModifiedFilesOptions): Promise<ModifiedFilesResult>;

  /**
   * Read the content of a specific file
   * @param filePath - Absolute path to the file
   * @param options - Read options
   * @returns File content with metadata
   */
  readFile(filePath: string, options?: ReadFileOptions): Promise<FileContent>;

  /**
   * Read multiple files at once
   * @param filePaths - Array of absolute paths to files
   * @param options - Read options
   * @returns Array of file contents with metadata
   */
  readFiles(filePaths: string[], options?: ReadFileOptions): Promise<FileContent[]>;
}

/**
 * Configuration for creating a FileWatcher
 */
export interface FileWatcherConfig extends WatcherOptions {
  sandbox: WatcherSandbox;
}
