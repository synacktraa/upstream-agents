/**
 * FileWatcher implementation for monitoring file changes in a sandbox
 */
import type {
  FileWatcher,
  FileWatcherConfig,
  WatcherSandbox,
} from "./core/watcher.js";
import type {
  ModifiedFile,
  ModifiedFilesResult,
  FileContent,
  GetModifiedFilesOptions,
  ReadFileOptions,
} from "./types/index.js";
import { debugLog } from "./debug.js";

/** Default file extensions to watch */
const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json"];

/** Default patterns to ignore */
const DEFAULT_IGNORE = ["node_modules", ".git", "dist", "build", ".next", "__pycache__"];

/** Default max file size (1MB) */
const DEFAULT_MAX_SIZE = 1024 * 1024;

/** Escape a string for use in shell commands */
function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''");
}

/**
 * Build the find command to locate modified files
 */
function buildFindCommand(
  path: string,
  extensions: string[],
  ignore: string[],
  sinceSeconds: number
): string {
  const safePath = escapeShell(path);

  // Build ignore patterns for find -prune
  const ignoreArgs = ignore
    .map((pattern) => `-name '${escapeShell(pattern)}' -prune`)
    .join(" -o ");

  // Build extension match patterns
  const extPatterns = extensions
    .map((ext) => `-name '*${escapeShell(ext)}'`)
    .join(" -o ");

  // Calculate mmin value (minutes, but we'll use -mmin with decimals isn't supported,
  // so we'll use find with -newermt for precise seconds)
  const sinceDate = new Date(Date.now() - sinceSeconds * 1000).toISOString();

  // Use -newermt for precise time-based filtering
  // Output: path|mtime|size (using stat for metadata)
  const command = `find '${safePath}' \\( ${ignoreArgs} \\) -o -type f \\( ${extPatterns} \\) -newermt '${sinceDate}' -print0 2>/dev/null | xargs -0 -r stat --format='%n|%Y|%s' 2>/dev/null || true`;

  return command;
}

/**
 * Parse the output of find + stat command
 */
function parseStatOutput(output: string): ModifiedFile[] {
  const files: ModifiedFile[] = [];
  const lines = output.trim().split("\n").filter(Boolean);

  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length >= 3) {
      const path = parts[0];
      const mtime = parseInt(parts[1], 10);
      const size = parseInt(parts[2], 10);

      if (path && !isNaN(mtime) && !isNaN(size)) {
        files.push({
          path,
          modifiedAt: new Date(mtime * 1000),
          size,
        });
      }
    }
  }

  return files;
}

/**
 * Create a FileWatcher implementation
 */
export class FileWatcherImpl implements FileWatcher {
  readonly path: string;
  readonly extensions: string[];
  readonly ignore: string[];
  private readonly sandbox: WatcherSandbox;

  constructor(config: FileWatcherConfig) {
    this.path = config.path;
    this.extensions = config.extensions ?? DEFAULT_EXTENSIONS;
    this.ignore = config.ignore ?? DEFAULT_IGNORE;
    this.sandbox = config.sandbox;

    debugLog(`Created watcher for path: ${this.path}`);
    debugLog(`Extensions: ${this.extensions.join(", ")}`);
    debugLog(`Ignore patterns: ${this.ignore.join(", ")}`);
  }

  async getModifiedFiles(options: GetModifiedFilesOptions): Promise<ModifiedFilesResult> {
    const { since } = options;
    debugLog(`Getting files modified in last ${since} seconds`);

    const command = buildFindCommand(this.path, this.extensions, this.ignore, since);
    debugLog(`Executing command: ${command}`);

    const output = await this.sandbox.executeCommand(command);
    const files = parseStatOutput(output);

    debugLog(`Found ${files.length} modified files`);

    return {
      files,
      queriedAt: new Date(),
    };
  }

  async readFile(filePath: string, options?: ReadFileOptions): Promise<FileContent> {
    const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;
    debugLog(`Reading file: ${filePath} (max size: ${maxSize})`);

    // First get file metadata
    const safePath = escapeShell(filePath);
    const statOutput = await this.sandbox.executeCommand(
      `stat --format='%Y|%s' '${safePath}'`
    );

    const parts = statOutput.trim().split("|");
    const mtime = parseInt(parts[0], 10);
    const size = parseInt(parts[1], 10);

    if (isNaN(mtime) || isNaN(size)) {
      throw new Error(`Failed to get metadata for file: ${filePath}`);
    }

    // Check file size
    if (size > maxSize) {
      throw new Error(`File too large: ${size} bytes (max: ${maxSize})`);
    }

    // Read the file content
    const content = await this.sandbox.readFile(filePath);

    return {
      path: filePath,
      content,
      modifiedAt: new Date(mtime * 1000),
      size,
    };
  }

  async readFiles(filePaths: string[], options?: ReadFileOptions): Promise<FileContent[]> {
    debugLog(`Reading ${filePaths.length} files`);

    // Read files in parallel
    const results = await Promise.all(
      filePaths.map((path) => this.readFile(path, options).catch((error) => {
        debugLog(`Failed to read file ${path}: ${error}`);
        return null;
      }))
    );

    // Filter out failed reads
    return results.filter((r): r is FileContent => r !== null);
  }
}

/**
 * Create a new FileWatcher instance
 */
export function createFileWatcher(config: FileWatcherConfig): FileWatcher {
  return new FileWatcherImpl(config);
}
