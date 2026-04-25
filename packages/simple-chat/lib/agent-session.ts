/**
 * Agent Session utilities for Simple Chat
 * Uses shared code from @upstream/common
 */

import {
  createSession,
  getSession,
  type Event,
  type EndEvent,
} from "background-agents"
import {
  buildSystemPrompt,
  buildContentBlocks,
  agentToProvider,
  type Agent,
  type ContentBlock,
  type ToolCall,
} from "@upstream/common"
import type { Sandbox as DaytonaSandbox } from "@daytonaio/sdk"

// Re-export Agent type for convenience
export type { Agent }

// =============================================================================
// Types
// =============================================================================

export interface AgentSessionOptions {
  repoPath: string
  previewUrlPattern?: string
  sessionId?: string
  agent?: Agent
  model?: string
  env?: Record<string, string>
}

// =============================================================================
// Background Session
// =============================================================================

export interface BackgroundAgentSession {
  backgroundSessionId: string
  start: (prompt: string) => Promise<void>
}

export async function createBackgroundAgentSession(
  sandbox: DaytonaSandbox,
  options: AgentSessionOptions
): Promise<BackgroundAgentSession> {
  const systemPrompt = buildSystemPrompt(
    options.repoPath,
    options.previewUrlPattern
  )

  // Map agent type to SDK provider name
  const agent = options.agent || "opencode"
  const provider = agentToProvider[agent] || "opencode"

  const bgSession = await createSession(provider, {
    sandbox: sandbox as any,
    systemPrompt,
    sessionId: options.sessionId,
    cwd: options.repoPath,
    model: options.model,
    env: options.env,
  })

  return {
    backgroundSessionId: bgSession.id,
    async start(prompt: string) {
      await bgSession.start(prompt)
    },
  }
}

// =============================================================================
// Polling
// =============================================================================

/**
 * Cumulative snapshot of an agent session at a point in time.
 * Source of truth: the event log file in the sandbox.
 */
export interface AgentSnapshot {
  status: "running" | "completed" | "error"
  content: string
  toolCalls: ToolCall[]
  contentBlocks: ContentBlock[]
  error?: string
  sessionId?: string
}

/**
 * Incremental result of a single poll. Returns only events that have arrived
 * since the previous poll on this session — callers should NOT treat
 * `events` as cumulative. For cumulative state use snapshotBackgroundAgent().
 */
export interface AgentPollResult {
  status: "running" | "completed" | "error"
  events: Event[]
  error?: string
  sessionId?: string
}

/**
 * Derive {content, toolCalls, contentBlocks, status, error} from a list of
 * events. Pass cumulative events to get a cumulative summary; pass deltas to
 * get a delta summary.
 */
function summarizeEvents(
  events: Event[],
  running: boolean,
  sessionId: string | null
): AgentSnapshot {
  const { content, toolCalls, contentBlocks } = buildContentBlocks(events)

  const crashEvent = events.find(
    (e) => (e as { type: string }).type === "agent_crashed"
  ) as { type: "agent_crashed"; message?: string } | undefined
  if (crashEvent) {
    return {
      status: "error",
      content,
      toolCalls,
      contentBlocks,
      error: crashEvent.message ?? "Process exited without completing",
      sessionId: sessionId || undefined,
    }
  }

  const endEvent = events.find((e): e is EndEvent => e.type === "end") as
    | (EndEvent & { error?: string })
    | undefined

  if (endEvent?.error) {
    return {
      status: "error",
      content,
      toolCalls,
      contentBlocks,
      error: endEvent.error,
      sessionId: sessionId || undefined,
    }
  }

  const isCompleted = !!endEvent

  if (!running && !endEvent) {
    const hasOutput = !!content?.trim() || toolCalls.length > 0
    return {
      status: hasOutput ? "completed" : "error",
      content,
      toolCalls,
      contentBlocks,
      error: hasOutput ? undefined : "Agent stopped without completing",
      sessionId: sessionId || undefined,
    }
  }

  return {
    status: isCompleted ? "completed" : "running",
    content,
    toolCalls,
    contentBlocks,
    sessionId: sessionId || undefined,
  }
}

/**
 * Poll for new events since the last call on this session. Use for
 * low-latency wire updates. Does NOT return cumulative state.
 */
export async function pollBackgroundAgent(
  sandbox: DaytonaSandbox,
  backgroundSessionId: string,
  options: AgentSessionOptions
): Promise<AgentPollResult> {
  try {
    const systemPrompt = buildSystemPrompt(
      options.repoPath,
      options.previewUrlPattern
    )

    const bgSession = await getSession(backgroundSessionId, {
      sandbox: sandbox as any,
      systemPrompt,
    })

    const result = (await bgSession.getEvents()) as {
      events: Event[]
      sessionId: string | null
      cursor: string
      running?: boolean
    }

    const running =
      typeof result.running === "boolean"
        ? result.running
        : await bgSession.isRunning()

    // Reuse summarizeEvents to derive status + error from this batch.
    // content/toolCalls/contentBlocks aren't returned because they'd be
    // misleading deltas; callers should use snapshotBackgroundAgent for those.
    const summary = summarizeEvents(result.events, running, result.sessionId)

    return {
      status: summary.status,
      events: result.events,
      error: summary.error,
      sessionId: summary.sessionId,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return {
      status: "error",
      events: [],
      error: msg,
    }
  }
}

/**
 * Read cumulative state by re-parsing the entire event log on disk in the
 * sandbox. Use on connect, on reconnect, and for any persistence write
 * where you need the full snapshot. Does not advance the session's cursor.
 */
export async function snapshotBackgroundAgent(
  sandbox: DaytonaSandbox,
  backgroundSessionId: string,
  options: AgentSessionOptions
): Promise<AgentSnapshot> {
  try {
    const systemPrompt = buildSystemPrompt(
      options.repoPath,
      options.previewUrlPattern
    )

    const bgSession = await getSession(backgroundSessionId, {
      sandbox: sandbox as any,
      systemPrompt,
    })

    const result = (await bgSession.getSnapshot()) as {
      events: Event[]
      sessionId: string | null
      cursor: string
      running?: boolean
    }

    const running =
      typeof result.running === "boolean"
        ? result.running
        : await bgSession.isRunning()

    return summarizeEvents(result.events, running, result.sessionId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return {
      status: "error",
      content: "",
      toolCalls: [],
      contentBlocks: [],
      error: msg,
    }
  }
}
