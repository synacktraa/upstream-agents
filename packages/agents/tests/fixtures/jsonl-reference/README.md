# JSONL Reference Files

This directory contains reference JSONL files demonstrating the raw output format of each supported AI coding agent CLI. These files serve as documentation and can be used for testing parsers.

## Files

| File | Provider | CLI Command |
|------|----------|-------------|
| `claude.jsonl` | Claude Code | `claude -p --output-format stream-json --verbose` |
| `codex.jsonl` | OpenAI Codex | `codex exec --json` |
| `gemini.jsonl` | Google Gemini | `gemini --output-format stream-json` |
| `opencode.jsonl` | OpenCode | `opencode run --format json` |

## Regenerating

To regenerate these files from the script:

```bash
cd packages/agents
npx tsx scripts/generate-jsonl-references.ts
```

## Event Type Summary

All providers emit events that are normalized to our standard event types:

| Standard Event | Description |
|----------------|-------------|
| `session` | Session initialized with ID |
| `token` | Text content from assistant |
| `tool_start` | Tool invocation started |
| `tool_delta` | Streaming tool input/output |
| `tool_end` | Tool invocation completed |
| `end` | Turn/session completed |
| `agent_crashed` | Process exited unexpectedly |

## Tool Name Normalization

Tool names are normalized across providers to a canonical set:

| Canonical Name | Description |
|----------------|-------------|
| `read` | Read file contents |
| `write` | Write/create file |
| `edit` | Edit/patch file |
| `glob` | File pattern search |
| `grep` | Content search |
| `shell` | Execute shell command |
| `web_search` | Web search (Claude only) |

### Provider-Specific Mappings

**Claude:**
- `Read` → `read`
- `Write` → `write`
- `Edit` → `edit`
- `Glob` → `glob`
- `Grep` → `grep`
- `Bash` → `shell`
- `WebSearch` → `web_search`

**Codex:**
- `command_execution` → `shell`
- `file_change` → `write`
- MCP tools: `read_file` → `read`, `write_file` → `write`, etc.

**Gemini:**
- `execute_code` → `shell`
- `read_file` → `read`
- `write_file` → `write`
- `apply_patch` → `edit`
- `glob_file_search` → `glob`
- `grep_search` → `grep`

**OpenCode:**
- `bash` → `shell`
- Other tools normalized to lowercase

## Usage in Tests

These files can be used to test the parser implementations:

```typescript
import { readFileSync } from "fs"
import { ClaudeProvider } from "../src/providers/claude.js"

const lines = readFileSync("tests/fixtures/jsonl-reference/claude.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)

const provider = new ClaudeProvider({ sandbox: mockSandbox, skipInstall: true })

for (const line of lines) {
  const event = provider.parse(line)
  console.log(event)
}
```
