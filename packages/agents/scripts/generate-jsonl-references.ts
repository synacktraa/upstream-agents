#!/usr/bin/env npx tsx
/**
 * Generate JSONL Reference Files
 *
 * This script generates reference JSONL files for each provider,
 * demonstrating the raw output format that each AI coding agent produces.
 * These files serve as documentation and can be used for testing parsers.
 *
 * Usage:
 *   npx tsx scripts/generate-jsonl-references.ts
 *
 * Output:
 *   tests/fixtures/jsonl-reference/
 *     ├── claude.jsonl          - Claude Code CLI raw output
 *     ├── codex.jsonl           - OpenAI Codex CLI raw output
 *     ├── gemini.jsonl          - Google Gemini CLI raw output
 *     └── opencode.jsonl        - OpenCode CLI raw output
 */

import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, "..", "tests", "fixtures", "jsonl-reference")

// Ensure fixtures directory exists
mkdirSync(FIXTURES_DIR, { recursive: true })

/**
 * Claude Code CLI JSONL Format
 *
 * Command: claude -p --output-format stream-json --verbose --dangerously-skip-permissions "prompt"
 *
 * Event types:
 * - system (subtype: init) - Session initialization
 * - assistant - Response text or tool invocation
 * - tool_use - Tool invocation (alternative format)
 * - tool_result - Tool execution result
 * - user - User message (may contain tool_result)
 * - result - Completion (success or error)
 */
const claudeEvents = [
  // Session initialization
  {
    type: "system",
    subtype: "init",
    session_id: "claude-session-abc123",
  },

  // Assistant text response
  {
    type: "assistant",
    message: {
      id: "msg_01",
      content: [
        {
          type: "text",
          text: "I'll help you with that. Let me first check the current directory.",
        },
      ],
    },
    session_id: "claude-session-abc123",
  },

  // Tool use via assistant message (Read tool)
  {
    type: "assistant",
    message: {
      id: "msg_02",
      content: [
        {
          type: "tool_use",
          name: "Read",
          input: {
            file_path: "/home/user/project/README.md",
          },
        },
      ],
    },
    session_id: "claude-session-abc123",
  },

  // Tool result (from user message)
  {
    type: "user",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool_use_01",
          content: "# Project Title\n\nThis is a sample project.",
        },
      ],
    },
  },

  // Alternative: Standalone tool_use event
  {
    type: "tool_use",
    name: "Bash",
    input: {
      command: "ls -la",
      description: "List files in current directory",
    },
  },

  // Standalone tool_result event
  {
    type: "tool_result",
    tool_use_id: "tool_use_02",
    result: "total 8\ndrwxr-xr-x  2 user user 4096 Jan 1 00:00 .\ndrwxr-xr-x 10 user user 4096 Jan 1 00:00 ..",
  },

  // Write tool example
  {
    type: "assistant",
    message: {
      id: "msg_03",
      content: [
        {
          type: "tool_use",
          name: "Write",
          input: {
            file_path: "/home/user/project/hello.txt",
            content: "Hello, World!",
          },
        },
      ],
    },
    session_id: "claude-session-abc123",
  },

  // Tool result with array content
  {
    type: "tool_result",
    tool_use_id: "tool_use_03",
    content: [{ type: "text", text: "File written successfully" }],
  },

  // Edit tool example
  {
    type: "tool_use",
    name: "Edit",
    input: {
      file_path: "/home/user/project/config.json",
      old_string: '"debug": false',
      new_string: '"debug": true',
    },
  },

  // Glob tool example
  {
    type: "tool_use",
    name: "Glob",
    input: {
      pattern: "**/*.ts",
    },
  },

  // Grep tool example
  {
    type: "tool_use",
    name: "Grep",
    input: {
      pattern: "TODO",
      path: "/home/user/project/src",
    },
  },

  // WebSearch tool example
  {
    type: "tool_use",
    name: "WebSearch",
    input: {
      query: "TypeScript best practices 2024",
    },
  },

  // Final text response
  {
    type: "assistant",
    message: {
      id: "msg_04",
      content: [
        {
          type: "text",
          text: "I've completed the task. The file has been created successfully.",
        },
      ],
    },
    session_id: "claude-session-abc123",
  },

  // Successful completion
  {
    type: "result",
    subtype: "success",
    result: "Task completed successfully",
    session_id: "claude-session-abc123",
  },

  // Error completion example (commented alternative)
  // {
  //   type: "result",
  //   subtype: "error_during_execution",
  //   error: "API rate limit exceeded",
  //   session_id: "claude-session-abc123",
  // },
]

/**
 * OpenAI Codex CLI JSONL Format
 *
 * Command: codex exec --json --skip-git-repo-check --yolo "prompt"
 *
 * Event types:
 * - thread.started - Session initialization
 * - item.message.delta - Text token
 * - item.started - Tool/action start (current schema)
 * - item.completed - Tool/action end with result (current schema)
 * - item.tool.start - Tool start (legacy)
 * - item.tool.input.delta - Tool input streaming (legacy)
 * - item.tool.end - Tool end (legacy)
 * - turn.completed - Turn complete
 * - turn.failed - Turn failed with error
 * - error - Fatal error
 */
const codexEvents = [
  // Session initialization
  {
    type: "thread.started",
    thread_id: "thread_abc123xyz",
  },

  // Text token streaming
  {
    type: "item.message.delta",
    text: "Let me help you with that task. ",
  },

  {
    type: "item.message.delta",
    text: "I'll start by examining the current directory.",
  },

  // Shell command start (current schema: item.started with type=command_execution)
  {
    type: "item.started",
    item: {
      id: "item_001",
      type: "command_execution",
      command: "ls -la",
      status: "in_progress",
    },
  },

  // Shell command end (current schema: item.completed with aggregated_output)
  {
    type: "item.completed",
    item: {
      id: "item_001",
      type: "command_execution",
      command: "ls -la",
      aggregated_output: "total 8\ndrwxr-xr-x  2 user user 4096 Jan 1 00:00 .\ndrwxr-xr-x 10 user user 4096 Jan 1 00:00 ..",
      exit_code: 0,
      status: "completed",
    },
  },

  // File change (item.completed with type=file_change)
  {
    type: "item.completed",
    item: {
      id: "item_002",
      type: "file_change",
      status: "completed",
      changes: [
        { path: "/home/user/project/hello.txt", kind: "add" },
      ],
    },
  },

  // MCP tool call start
  {
    type: "item.started",
    item: {
      id: "item_003",
      type: "mcp_tool_call",
      tool: "read_file",
      arguments: {
        path: "/home/user/project/README.md",
      },
    },
  },

  // MCP tool call end
  {
    type: "item.completed",
    item: {
      id: "item_003",
      type: "mcp_tool_call",
      tool: "read_file",
      result: {
        content: [{ type: "text", text: "# Project\n\nThis is the README." }],
      },
    },
  },

  // Full agent message (alternative to deltas)
  {
    type: "item.completed",
    item: {
      id: "item_004",
      type: "agent_message",
      text: "I've read the file and it contains project documentation.",
    },
  },

  // Legacy tool format: tool start
  {
    type: "item.tool.start",
    name: "shell",
  },

  // Legacy tool format: input delta
  {
    type: "item.tool.input.delta",
    text: "echo 'Hello World'",
  },

  // Legacy tool format: tool end
  {
    type: "item.tool.end",
  },

  // More text
  {
    type: "item.message.delta",
    text: "Task completed successfully.",
  },

  // Turn completed
  {
    type: "turn.completed",
  },

  // Turn failed example (alternative ending)
  // {
  //   type: "turn.failed",
  //   error: {
  //     message: "API rate limit exceeded",
  //   },
  // },

  // Error example (fatal error)
  // {
  //   type: "error",
  //   message: "unexpected status 401 Unauthorized",
  // },
]

/**
 * Google Gemini CLI JSONL Format
 *
 * Command: gemini --output-format stream-json -p "prompt"
 *
 * Event types:
 * - init - Session initialization
 * - assistant.delta - Text token (legacy)
 * - message - Full message (new format)
 * - tool.start - Tool invocation start
 * - tool.delta - Tool output streaming
 * - tool.end - Tool invocation end
 * - assistant.complete - Completion (legacy)
 * - result - Completion (new format)
 */
const geminiEvents = [
  // Session initialization
  {
    type: "init",
    session_id: "gemini-session-xyz789",
  },

  // Text token (legacy format)
  {
    type: "assistant.delta",
    text: "I'll help you accomplish this task. ",
  },

  {
    type: "assistant.delta",
    text: "Let me start by examining your project.",
  },

  // Message event (new format)
  {
    type: "message",
    role: "assistant",
    content: "First, I'll list the files in the current directory.",
    delta: true,
  },

  // Tool start (execute_code -> normalized to "shell")
  {
    type: "tool.start",
    name: "execute_code",
    input: {
      code: "ls -la",
      language: "bash",
    },
  },

  // Tool output streaming
  {
    type: "tool.delta",
    text: "total 8\n",
  },

  {
    type: "tool.delta",
    text: "drwxr-xr-x  2 user user 4096 Jan 1 00:00 .\n",
  },

  {
    type: "tool.delta",
    text: "drwxr-xr-x 10 user user 4096 Jan 1 00:00 ..",
  },

  // Tool end
  {
    type: "tool.end",
  },

  // Read file tool
  {
    type: "tool.start",
    name: "read_file",
    input: {
      path: "/home/user/project/package.json",
    },
  },

  {
    type: "tool.delta",
    text: '{\n  "name": "my-project",\n  "version": "1.0.0"\n}',
  },

  {
    type: "tool.end",
  },

  // Write file tool
  {
    type: "tool.start",
    name: "write_file",
    input: {
      path: "/home/user/project/output.txt",
      content: "Hello, World!",
    },
  },

  {
    type: "tool.delta",
    text: "File written successfully",
  },

  {
    type: "tool.end",
  },

  // Apply patch (edit) tool
  {
    type: "tool.start",
    name: "apply_patch",
    input: {
      path: "/home/user/project/config.json",
      patch: "@@ -1,3 +1,3 @@\n-debug: false\n+debug: true",
    },
  },

  {
    type: "tool.end",
  },

  // Glob search tool
  {
    type: "tool.start",
    name: "glob_file_search",
    input: {
      pattern: "**/*.ts",
    },
  },

  {
    type: "tool.delta",
    text: "src/index.ts\nsrc/utils.ts",
  },

  {
    type: "tool.end",
  },

  // Grep search tool
  {
    type: "tool.start",
    name: "grep_search",
    input: {
      pattern: "TODO",
      path: "src/",
    },
  },

  {
    type: "tool.delta",
    text: "src/index.ts:10: // TODO: implement this",
  },

  {
    type: "tool.end",
  },

  // Final assistant text
  {
    type: "assistant.delta",
    text: "I've completed all the requested tasks.",
  },

  // Completion (legacy format)
  {
    type: "assistant.complete",
  },

  // Completion (new format - alternative)
  // {
  //   type: "result",
  //   status: "success",
  // },
]

/**
 * OpenCode CLI JSONL Format
 *
 * Command: opencode run --format json --variant medium "prompt"
 *
 * Event types:
 * - step_start - Session initialization
 * - text - Text content
 * - tool_call - Tool invocation start
 * - tool_use - Tool execution (stream-json format)
 * - tool_result - Tool completion
 * - step_finish - Step/turn completion
 * - error - Error event
 */
const opencodeEvents = [
  // Session initialization
  {
    type: "step_start",
    sessionID: "ses_opencode123",
    part: {
      id: "part_001",
      sessionID: "ses_opencode123",
      messageID: "msg_001",
      type: "step-start",
    },
  },

  // Text content
  {
    type: "text",
    sessionID: "ses_opencode123",
    part: {
      id: "part_002",
      sessionID: "ses_opencode123",
      messageID: "msg_001",
      type: "text",
      text: "I'll help you with that task. Let me start by examining the project.",
    },
  },

  // More text
  {
    type: "text",
    sessionID: "ses_opencode123",
    part: {
      id: "part_003",
      sessionID: "ses_opencode123",
      messageID: "msg_001",
      type: "text",
      text: " First, I'll check what files are available.",
    },
  },

  // Tool call start (bash -> normalized to "shell")
  {
    type: "tool_call",
    sessionID: "ses_opencode123",
    part: {
      id: "part_004",
      type: "tool-call",
      tool: "bash",
      args: {
        command: "ls -la",
      },
    },
  },

  // Tool result
  {
    type: "tool_result",
    sessionID: "ses_opencode123",
    part: {
      id: "part_005",
      type: "tool-result",
    },
  },

  // Tool use (stream-json format - shows completed tool)
  {
    type: "tool_use",
    sessionID: "ses_opencode123",
    part: {
      id: "part_006",
      tool: "read_file",
      state: {
        status: "completed",
        input: {
          path: "/home/user/project/README.md",
        },
      },
    },
  },

  // Write file tool call
  {
    type: "tool_call",
    sessionID: "ses_opencode123",
    part: {
      id: "part_007",
      type: "tool-call",
      tool: "write_file",
      args: {
        path: "/home/user/project/output.txt",
        content: "Hello, World!",
      },
    },
  },

  {
    type: "tool_result",
    sessionID: "ses_opencode123",
    part: {
      id: "part_008",
      type: "tool-result",
    },
  },

  // Final text
  {
    type: "text",
    sessionID: "ses_opencode123",
    part: {
      id: "part_009",
      sessionID: "ses_opencode123",
      messageID: "msg_001",
      type: "text",
      text: "I've completed the task successfully.",
    },
  },

  // Step finish (reason: "tool-calls" - intermediate, ignored)
  {
    type: "step_finish",
    sessionID: "ses_opencode123",
    part: {
      id: "part_010",
      type: "step-finish",
      reason: "tool-calls",
    },
  },

  // Step finish (reason: "stop" - final, triggers end event)
  {
    type: "step_finish",
    sessionID: "ses_opencode123",
    part: {
      id: "part_011",
      type: "step-finish",
      reason: "stop",
    },
  },

  // Error example (alternative ending)
  // {
  //   type: "error",
  //   sessionID: "ses_opencode123",
  //   error: {
  //     name: "APIError",
  //     data: {
  //       message: "Rate limit exceeded",
  //     },
  //   },
  // },
]

/**
 * Write events to a JSONL file
 */
function writeJsonlFile(filename: string, events: object[]): void {
  const filepath = join(FIXTURES_DIR, filename)
  const content = events.map((e) => JSON.stringify(e)).join("\n") + "\n"
  writeFileSync(filepath, content, "utf8")
  console.log(`Generated: ${filepath}`)
}

// Generate all reference files
writeJsonlFile("claude.jsonl", claudeEvents)
writeJsonlFile("codex.jsonl", codexEvents)
writeJsonlFile("gemini.jsonl", geminiEvents)
writeJsonlFile("opencode.jsonl", opencodeEvents)

console.log("\nAll JSONL reference files generated successfully!")
console.log(`Output directory: ${FIXTURES_DIR}`)
