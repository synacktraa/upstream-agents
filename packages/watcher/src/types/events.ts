/**
 * Represents a modified file detected by the watcher
 */
export interface ModifiedFile {
  /** Absolute path to the file */
  path: string;
  /** When the file was last modified */
  modifiedAt: Date;
  /** File size in bytes */
  size: number;
}

/**
 * Result of a file content read operation
 */
export interface FileContent {
  /** Absolute path to the file */
  path: string;
  /** File content as string */
  content: string;
  /** When the file was last modified */
  modifiedAt: Date;
  /** File size in bytes */
  size: number;
}

/**
 * Result of getModifiedFiles call
 */
export interface ModifiedFilesResult {
  /** List of modified files */
  files: ModifiedFile[];
  /** Timestamp when the query was executed */
  queriedAt: Date;
}
