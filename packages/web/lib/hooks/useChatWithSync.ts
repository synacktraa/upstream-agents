"use client"

/**
 * useChat hook with server sync - Refactored with TanStack Query
 *
 * This hook manages chat state with the following responsibilities:
 * 1. TanStack Query for server data (chats, settings, messages)
 * 2. Local React state for device-specific data (currentChatId, unseenChatIds)
 * 3. SSE streaming for real-time agent output (unchanged from original)
 * 4. localStorage for local-only state persistence (previewItem, queuedMessages)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { nanoid } from "nanoid"
import type { Chat, ChatStatus, Message, QueuedMessage, Settings, SSEUpdateEvent, SSECompleteEvent, Agent } from "@/lib/types"
import { NEW_REPOSITORY, getDefaultAgent, getDefaultModelForAgent } from "@/lib/types"
import type { Credentials } from "@/lib/credentials"
import { generateBranchName } from "@/lib/utils"
import {
  // Local state (device-specific)
  loadLocalState,
  setCurrentChatId as persistCurrentChatId,
  setPreviewItem,
  loadUnseenChatIds,
  saveUnseenChatIds,
  setQueuedMessages,
  setQueuePaused,
  // Merge utilities
  mergeChats,
  mergeMessages,
  // Legacy helpers
  collectDescendantIds,
  DEFAULT_SETTINGS,
} from "@/lib/storage"
import {
  // Queries
  useChatsQuery,
  useSettingsQuery,
  queryKeys,
  // Mutations
  useCreateChatMutation,
  useUpdateChatMutation,
  useDeleteChatMutation,
  useUpdateSettingsMutation,
  useSuggestNameMutation,
  useGitPushMutation,
  useSandboxDeleteMutation,
} from "@/lib/query"
import { useStreamStore } from "@/lib/stores/stream-store"

// SSE reconnection settings
const SSE_RECONNECT_DELAY = 1000
const SSE_MAX_RECONNECT_ATTEMPTS = 10

export function useChatWithSync() {
  const { data: session, status: sessionStatus } = useSession()
  const queryClient = useQueryClient()

  // =============================================================================
  // TanStack Query Hooks
  // =============================================================================

  const chatsQuery = useChatsQuery()
  const settingsQuery = useSettingsQuery()

  // Mutations
  const createChatMutation = useCreateChatMutation()
  const updateChatMutation = useUpdateChatMutation()
  const deleteChatMutation = useDeleteChatMutation()
  const updateSettingsMutation = useUpdateSettingsMutation()
  const suggestNameMutation = useSuggestNameMutation()
  const gitPushMutation = useGitPushMutation()
  const sandboxDeleteMutation = useSandboxDeleteMutation()

  // =============================================================================
  // Local State (Device-Specific - NOT synced to server)
  // =============================================================================

  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [unseenChatIds, setUnseenChatIds] = useState<Set<string>>(new Set())
  const [deletingChatIds, setDeletingChatIds] = useState<Set<string>>(new Set())

  // Local-only state: previewItems, queuedMessages, queuePaused per chat
  const [localChatState, setLocalChatState] = useState<{
    previewItems: Record<string, Chat["previewItem"]>
    queuedMessages: Record<string, Chat["queuedMessages"]>
    queuePaused: Record<string, boolean>
  }>({ previewItems: {}, queuedMessages: {}, queuePaused: {} })

  // Track previous statuses for unseen detection
  const prevStatuses = useRef<Map<string, ChatStatus>>(new Map())

  // Synchronous guard for sendMessage re-entry
  const sendInFlight = useRef<Set<string>>(new Set())

  // =============================================================================
  // Hydration - Load local state on mount
  // =============================================================================

  useEffect(() => {
    const localState = loadLocalState()
    setCurrentChatId(localState.currentChatId)
    setUnseenChatIds(loadUnseenChatIds())
    setLocalChatState({
      previewItems: localState.previewItems,
      queuedMessages: localState.queuedMessages,
      queuePaused: localState.queuePaused,
    })
    setIsHydrated(true)
  }, [])

  // =============================================================================
  // Derived State
  // =============================================================================

  // Merge server chats with local-only state
  const chats = useMemo((): Chat[] => {
    const serverChats = chatsQuery.data ?? []
    return serverChats.map((chat) => ({
      ...chat,
      previewItem: localChatState.previewItems[chat.id],
      queuedMessages: localChatState.queuedMessages[chat.id],
      queuePaused: localChatState.queuePaused[chat.id],
    }))
  }, [chatsQuery.data, localChatState])

  const settings = settingsQuery.data?.settings ?? DEFAULT_SETTINGS
  const credentialFlags = settingsQuery.data?.credentialFlags ?? {}

  const currentChat = useMemo(() => {
    return chats.find((c) => c.id === currentChatId) ?? null
  }, [chats, currentChatId])

  const isLoading = chatsQuery.isLoading || settingsQuery.isLoading

  // =============================================================================
  // Persist unseen set (device-specific)
  // =============================================================================

  useEffect(() => {
    if (isHydrated) {
      saveUnseenChatIds(unseenChatIds)
    }
  }, [unseenChatIds, isHydrated])

  // Detect running → non-running transitions and mark unseen
  useEffect(() => {
    if (!isHydrated) return

    const currentIds = new Set<string>()
    const newlyUnseen: string[] = []
    for (const chat of chats) {
      currentIds.add(chat.id)
      const prevStatus = prevStatuses.current.get(chat.id)
      if (
        prevStatus === "running" &&
        chat.status !== "running" &&
        chat.id !== currentChatId
      ) {
        newlyUnseen.push(chat.id)
      }
      prevStatuses.current.set(chat.id, chat.status)
    }
    for (const id of Array.from(prevStatuses.current.keys())) {
      if (!currentIds.has(id)) prevStatuses.current.delete(id)
    }

    setUnseenChatIds((prev) => {
      let next = prev
      for (const id of newlyUnseen) {
        if (!prev.has(id)) {
          if (next === prev) next = new Set(prev)
          next.add(id)
        }
      }
      for (const id of prev) {
        if (!currentIds.has(id)) {
          if (next === prev) next = new Set(prev)
          next.delete(id)
        }
      }
      return next
    })
  }, [chats, currentChatId, isHydrated])

  // =============================================================================
  // Chat Operations
  // =============================================================================

  const startNewChat = useCallback(async (
    repo: string = NEW_REPOSITORY,
    baseBranch: string = "main",
    parentChatId?: string,
    switchTo: boolean = true,
    initialStatus: Chat["status"] = "pending",
  ): Promise<string | null> => {
    try {
      const newChat = await createChatMutation.mutateAsync({
        repo,
        baseBranch,
        parentChatId,
        status: initialStatus,
      })

      if (switchTo) {
        setCurrentChatId(newChat.id)
        persistCurrentChatId(newChat.id)
      }

      return newChat.id
    } catch (error) {
      console.error("Failed to create chat:", error)
      return null
    }
  }, [createChatMutation])

  const selectChat = useCallback((chatId: string) => {
    // Mark as seen
    setUnseenChatIds((prev) => {
      if (!prev.has(chatId)) return prev
      const next = new Set(prev)
      next.delete(chatId)
      return next
    })

    // Update local state
    setCurrentChatId(chatId)
    persistCurrentChatId(chatId)

    // Fetch chat messages if not loaded
    // TanStack Query will handle caching automatically
  }, [])

  const removeChat = useCallback(async (chatId: string) => {
    // Collect descendants locally first for UI
    const allIds = collectDescendantIds(chats, chatId)

    // Stop SSE streams and mark as deleting
    for (const id of allIds) useStreamStore.getState().stopStream(id)
    setDeletingChatIds((prev) => new Set([...prev, ...allIds]))

    try {
      const result = await deleteChatMutation.mutateAsync(chatId)

      // Clean up sandboxes (fire-and-forget)
      for (const sandboxId of result.sandboxIdsToCleanup) {
        sandboxDeleteMutation.mutate(sandboxId)
      }

      // Clean up local state
      setLocalChatState((prev) => {
        const next = { ...prev }
        for (const id of result.deletedChatIds) {
          delete next.previewItems[id]
          delete next.queuedMessages[id]
          delete next.queuePaused[id]
        }
        return next
      })

      // Update current chat if deleted
      if (result.deletedChatIds.includes(currentChatId ?? "")) {
        const remaining = chats.filter((c) => !result.deletedChatIds.includes(c.id))
        const nextChat = remaining[0]?.id ?? null
        setCurrentChatId(nextChat)
        persistCurrentChatId(nextChat)
      }
    } catch (error) {
      console.error("Failed to delete chat:", error)
    } finally {
      setDeletingChatIds((prev) => {
        const next = new Set(prev)
        for (const id of allIds) next.delete(id)
        return next
      })
    }
  }, [chats, currentChatId, deleteChatMutation, sandboxDeleteMutation])

  const renameChat = useCallback(async (chatId: string, newName: string) => {
    try {
      await updateChatMutation.mutateAsync({
        chatId,
        data: { displayName: newName },
      })
    } catch (error) {
      console.error("Failed to rename chat:", error)
    }
  }, [updateChatMutation])

  const updateChatRepo = useCallback(async (chatId: string, repo: string, baseBranch: string) => {
    const chat = chats.find((c) => c.id === chatId)
    if (!chat) return

    const canSelectRepo = chat.messages.length === 0 && !chat.sandboxId
    const canAssignNewRepo = chat.repo === NEW_REPOSITORY && repo !== NEW_REPOSITORY

    if (!canSelectRepo && !canAssignNewRepo) return

    try {
      await updateChatMutation.mutateAsync({
        chatId,
        data: { repo, baseBranch },
      })
    } catch (error) {
      console.error("Failed to update chat repo:", error)
    }
  }, [chats, updateChatMutation])

  // =============================================================================
  // Settings
  // =============================================================================

  const updateSettings = useCallback(async (data: {
    settings?: Partial<Settings>
    credentials?: Credentials
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      await updateSettingsMutation.mutateAsync(data)
      return { ok: true }
    } catch (error) {
      console.error("Failed to update settings:", error)
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save settings",
      }
    }
  }, [updateSettingsMutation])

  const updateCurrentChat = useCallback(async (updates: Partial<Chat>) => {
    if (!currentChatId) return

    // Separate local-only fields from server-synced fields
    const { previewItem, queuedMessages, queuePaused, ...serverUpdates } = updates

    // Handle local-only updates
    if (previewItem !== undefined) {
      setPreviewItem(currentChatId, previewItem)
      setLocalChatState((prev) => ({
        ...prev,
        previewItems: { ...prev.previewItems, [currentChatId]: previewItem },
      }))
    }

    // Only call the server API if there are server-synced fields to update
    if (Object.keys(serverUpdates).length > 0) {
      try {
        await updateChatMutation.mutateAsync({
          chatId: currentChatId,
          data: serverUpdates as Parameters<typeof updateChatMutation.mutateAsync>[0]["data"],
        })
      } catch (error) {
        console.error("Failed to update chat:", error)
      }
    }
  }, [currentChatId, updateChatMutation])

  const updateChatById = useCallback(async (chatId: string, updates: Partial<Chat>) => {
    // Separate local-only fields from server-synced fields
    const { previewItem, queuedMessages, queuePaused, ...serverUpdates } = updates

    // Handle local-only updates
    if (previewItem !== undefined) {
      setPreviewItem(chatId, previewItem)
      setLocalChatState((prev) => ({
        ...prev,
        previewItems: { ...prev.previewItems, [chatId]: previewItem },
      }))
    }

    // Only call the server API if there are server-synced fields to update
    if (Object.keys(serverUpdates).length > 0) {
      try {
        await updateChatMutation.mutateAsync({
          chatId,
          data: serverUpdates as Parameters<typeof updateChatMutation.mutateAsync>[0]["data"],
        })
      } catch (error) {
        console.error("Failed to update chat:", error)
      }
    }
  }, [updateChatMutation])

  // =============================================================================
  // SSE Streaming (Unchanged from original)
  // =============================================================================

  const startStreaming = useCallback((
    chatId: string,
    sandboxId: string,
    repoName: string,
    backgroundSessionId: string,
    assistantMessageId: string,
    previewUrlPattern?: string,
    abortSignal?: AbortSignal
  ) => {
    const streamStore = useStreamStore.getState()

    if (streamStore.isStreaming(chatId)) {
      streamStore.stopStream(chatId)
    }

    streamStore.startStream(chatId, {
      sandboxId,
      repoName,
      backgroundSessionId,
      previewUrlPattern,
    })

    const connect = (cursor: number = 0) => {
      if (abortSignal?.aborted) {
        streamStore.stopStream(chatId)
        return
      }

      const currentStore = useStreamStore.getState()
      const streamState = currentStore.getStream(chatId)
      if (!streamState) return

      const params = new URLSearchParams({
        sandboxId,
        repoName,
        backgroundSessionId,
        chatId,
        assistantMessageId,
      })
      if (previewUrlPattern) params.set("previewUrlPattern", previewUrlPattern)
      if (cursor > 0) params.set("cursor", cursor.toString())

      const eventSource = new EventSource(`/api/agent/stream?${params}`)
      currentStore.updateStream(chatId, { eventSource })

      // Close EventSource when abort signal fires
      const abortHandler = () => {
        eventSource.close()
        useStreamStore.getState().stopStream(chatId)
      }
      abortSignal?.addEventListener("abort", abortHandler, { once: true })

      eventSource.addEventListener("update", (event) => {
        if (abortSignal?.aborted) return

        try {
          const data: SSEUpdateEvent = JSON.parse(event.data)
          const store = useStreamStore.getState()
          if (!store.isStreaming(chatId)) return

          store.updateStream(chatId, {
            cursor: data.cursor,
            reconnectAttempts: 0,
          })

          // Update the chat in TanStack Query cache
          queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old) => {
            if (!old) return old
            return old.map((c) => {
              if (c.id !== chatId) return c
              const messages = [...c.messages]
              const lastIndex = messages.length - 1
              if (lastIndex >= 0) {
                messages[lastIndex] = {
                  ...messages[lastIndex],
                  content: data.content,
                  toolCalls: data.toolCalls,
                  contentBlocks: data.contentBlocks,
                }
              }
              return { ...c, messages, lastActiveAt: Date.now() }
            })
          })
        } catch (err) {
          console.error("Failed to parse SSE update:", err)
        }
      })

      eventSource.addEventListener("complete", async (event) => {
        if (abortSignal?.aborted) return

        try {
          const data: SSECompleteEvent = JSON.parse(event.data)

          useStreamStore.getState().stopStream(chatId)

          const updates: Partial<Chat> = {
            status: data.status === "error" ? "error" : "ready",
            backgroundSessionId: undefined,
            lastActiveAt: Date.now(),
            errorMessage: data.status === "error" ? (data.error || "Agent failed without an error message") : undefined,
          }
          if (data.sessionId) {
            updates.sessionId = data.sessionId
          }

          // Update cache
          queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old) => {
            if (!old) return old
            return old.map((c) =>
              c.id === chatId ? { ...c, ...updates } : c
            )
          })

          // Auto-push for GitHub repos
          if (data.status === "completed") {
            const chat = chats.find((c) => c.id === chatId)
            if (chat?.branch && chat.repo !== NEW_REPOSITORY) {
              gitPushMutation.mutate(
                { sandboxId, repoName, branch: chat.branch },
                {
                  onError: (err) => {
                    // Add error message to chat
                    const errorMessage: Message = {
                      id: nanoid(),
                      role: "assistant",
                      content: `Push failed: ${err.message}`,
                      messageType: "git-operation",
                      isError: true,
                      timestamp: Date.now(),
                    }
                    queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old) => {
                      if (!old) return old
                      return old.map((c) =>
                        c.id === chatId
                          ? { ...c, messages: [...c.messages, errorMessage] }
                          : c
                      )
                    })
                  },
                }
              )
            }
          }
        } catch (err) {
          console.error("Failed to parse SSE complete:", err)
        }
      })

      eventSource.addEventListener("heartbeat", (event) => {
        if (abortSignal?.aborted) return

        try {
          const data = JSON.parse(event.data)
          const store = useStreamStore.getState()
          if (store.isStreaming(chatId)) {
            store.updateStream(chatId, {
              cursor: data.cursor,
              reconnectAttempts: 0,
            })
          }
        } catch (err) {
          console.error("Failed to parse heartbeat:", err)
        }
      })

      eventSource.addEventListener("error", (event) => {
        if (abortSignal?.aborted) return

        try {
          const data = JSON.parse((event as MessageEvent).data)
          console.error("SSE error:", data.error)
          useStreamStore.getState().stopStream(chatId)

          const errorMessage = data.error || "Agent stream failed without an error message"
          queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old) => {
            if (!old) return old
            return old.map((c) =>
              c.id === chatId
                ? { ...c, status: "error" as const, backgroundSessionId: undefined, errorMessage }
                : c
            )
          })
        } catch {
          // Connection error - handled by onerror
        }
      })

      eventSource.onerror = () => {
        if (abortSignal?.aborted) return

        eventSource.close()
        const store = useStreamStore.getState()
        const stream = store.getStream(chatId)
        if (!stream) return

        const attempts = (stream.reconnectAttempts || 0) + 1
        if (attempts <= SSE_MAX_RECONNECT_ATTEMPTS) {
          store.updateStream(chatId, {
            reconnectAttempts: attempts,
            eventSource: null,
          })
          setTimeout(() => {
            if (useStreamStore.getState().isStreaming(chatId)) {
              connect(stream.cursor)
            }
          }, SSE_RECONNECT_DELAY)
        } else {
          store.stopStream(chatId)
          queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old) => {
            if (!old) return old
            return old.map((c) =>
              c.id === chatId && c.status === "running"
                ? { ...c, status: "ready" as const }
                : c
            )
          })
        }
      }
    }

    connect()
  }, [queryClient, chats, gitPushMutation])

  // =============================================================================
  // Messaging
  // =============================================================================

  const sendMessage = useCallback(async (
    content: string,
    agent?: string,
    model?: string,
    files?: File[],
    targetChatId?: string
  ) => {
    const chatId = targetChatId || currentChatId
    if (!chatId) return

    const chat = chats.find((c) => c.id === chatId)
    if (!chat) return

    // Concurrency guards
    if (sendInFlight.current.has(chatId)) {
      console.warn("Send already in flight for this chat")
      return
    }
    if (useStreamStore.getState().isStreaming(chatId)) {
      console.warn("Already streaming for this chat")
      return
    }
    if (chat.status === "creating" || chat.status === "running") {
      console.warn(`Chat is ${chat.status}; can't send`)
      return
    }
    sendInFlight.current.add(chatId)

    try {
      if (!session?.accessToken) return

      const isFirstMessage = chat.messages.length === 0
      const selectedAgent = (agent ?? chat.agent ?? settings.defaultAgent ?? getDefaultAgent(credentialFlags)) as Agent
      const selectedModel = model ?? chat.model ?? settings.defaultModel ?? getDefaultModelForAgent(selectedAgent, credentialFlags)

      // Optimistic UI: add user + assistant messages immediately
      const userMessage: Message = {
        id: nanoid(),
        role: "user",
        content,
        timestamp: Date.now(),
      }
      const assistantMessage: Message = {
        id: nanoid(),
        role: "assistant",
        content: "",
        timestamp: Date.now() + 1,
        toolCalls: [],
        contentBlocks: [],
      }

      // Update cache optimistically
      queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old) => {
        if (!old) return old
        return old.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: [...c.messages, userMessage, assistantMessage],
                status: chat.sandboxId ? ("running" as const) : ("creating" as const),
                lastActiveAt: Date.now(),
                queuePaused: false,
                errorMessage: undefined,
              }
            : c
        )
      })

      try {
        // One server round-trip: orchestrate sandbox-create + file-upload +
        // message-persist + agent-start atomically
        const payload = {
          message: content,
          agent: selectedAgent,
          model: selectedModel,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          newBranch: chat.sandboxId ? undefined : `agent/${generateBranchName()}`,
        }

        let response: Response
        if (files && files.length > 0) {
          const formData = new FormData()
          formData.append("payload", JSON.stringify(payload))
          files.forEach((file, i) => formData.append(`file-${i}`, file))
          response = await fetch(`/api/chats/${chatId}/messages`, {
            method: "POST",
            body: formData,
          })
        } else {
          response = await fetch(`/api/chats/${chatId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error || "Failed to send message")
        }

        const data = (await response.json()) as {
          sandboxId: string
          branch: string | null
          previewUrlPattern: string | null
          backgroundSessionId: string
          uploadedFiles: string[]
        }

        // Update cache with server-confirmed data
        queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old) => {
          if (!old) return old
          return old.map((c) =>
            c.id !== chatId
              ? c
              : {
                  ...c,
                  sandboxId: data.sandboxId,
                  branch: data.branch,
                  previewUrlPattern: data.previewUrlPattern ?? undefined,
                  backgroundSessionId: data.backgroundSessionId,
                  agent: selectedAgent,
                  model: selectedModel,
                  status: "running" as const,
                  messages: c.messages.map((m) =>
                    m.id === userMessage.id && data.uploadedFiles.length > 0
                      ? { ...m, uploadedFiles: data.uploadedFiles }
                      : m
                  ),
                }
          )
        })

        // Start SSE streaming
        startStreaming(
          chatId,
          data.sandboxId,
          "project",
          data.backgroundSessionId,
          assistantMessage.id,
          data.previewUrlPattern ?? undefined
        )

        // Generate chat name for first message (fire-and-forget)
        if (isFirstMessage) {
          suggestNameMutation.mutate({ chatId, prompt: content })
        }
      } catch (error) {
        console.error("Failed to send message:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"

        // Mark as error in cache
        queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old) => {
          if (!old) return old
          return old.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  status: "error" as const,
                  errorMessage,
                  messages: c.messages.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: `Error: ${errorMessage}`, isError: true }
                      : m
                  ),
                }
              : c
          )
        })
      }
    } finally {
      sendInFlight.current.delete(chatId)
    }
  }, [currentChatId, chats, session?.accessToken, settings, credentialFlags, queryClient, startStreaming, suggestNameMutation])

  const stopAgent = useCallback(() => {
    if (!currentChat) return

    useStreamStore.getState().stopStream(currentChat.id)
    const hasQueue = (currentChat.queuedMessages?.length ?? 0) > 0

    queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old) => {
      if (!old) return old
      return old.map((c) =>
        c.id === currentChat.id
          ? { ...c, status: "ready" as const, queuePaused: hasQueue ? true : c.queuePaused }
          : c
      )
    })

    if (hasQueue) {
      setQueuePaused(currentChat.id, true)
      setLocalChatState((prev) => ({
        ...prev,
        queuePaused: { ...prev.queuePaused, [currentChat.id]: true },
      }))
    }
  }, [currentChat, queryClient])

  // Recovery: resume streaming for running chats
  const runningChatsKey = chats
    .filter((c) => c.backgroundSessionId && c.sandboxId)
    .map((c) => `${c.id}:${c.backgroundSessionId}:${c.sandboxId}`)
    .sort()
    .join("|")

  useEffect(() => {
    if (!isHydrated) return

    const abortController = new AbortController()

    const runningChats = chats.filter(
      (c) => c.backgroundSessionId && c.sandboxId
    )

    for (const chat of runningChats) {
      if (useStreamStore.getState().isStreaming(chat.id)) continue

      const lastAssistantMsg = [...chat.messages]
        .reverse()
        .find((m) => m.role === "assistant")

      if (lastAssistantMsg) {
        startStreaming(
          chat.id,
          chat.sandboxId!,
          "project",
          chat.backgroundSessionId!,
          lastAssistantMsg.id,
          chat.previewUrlPattern,
          abortController.signal
        )
      }
    }

    return () => {
      abortController.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, runningChatsKey, startStreaming])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const store = useStreamStore.getState()
      for (const chatId of store.streams.keys()) {
        store.stopStream(chatId)
      }
    }
  }, [])

  // =============================================================================
  // Queue Management (Local)
  // =============================================================================

  const addMessageToChat = useCallback((chatId: string, message: Message) => {
    queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old) => {
      if (!old) return old
      return old.map((c) =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, message] }
          : c
      )
    })
  }, [queryClient])

  const enqueueMessage = useCallback((content: string, agent?: string, model?: string) => {
    if (!currentChat) return

    const queued: QueuedMessage = {
      id: `q-${Date.now()}`,
      content,
      agent,
      model,
    }
    const existing = currentChat.queuedMessages ?? []
    const newQueue = [...existing, queued]

    setQueuedMessages(currentChat.id, newQueue)
    setQueuePaused(currentChat.id, false)

    setLocalChatState((prev) => ({
      ...prev,
      queuedMessages: { ...prev.queuedMessages, [currentChat.id]: newQueue },
      queuePaused: { ...prev.queuePaused, [currentChat.id]: false },
    }))
  }, [currentChat])

  const removeQueuedMessage = useCallback((id: string) => {
    if (!currentChat) return

    const existing = currentChat.queuedMessages ?? []
    const newQueue = existing.filter((m) => m.id !== id)

    setQueuedMessages(currentChat.id, newQueue)

    setLocalChatState((prev) => ({
      ...prev,
      queuedMessages: { ...prev.queuedMessages, [currentChat.id]: newQueue },
    }))
  }, [currentChat])

  const resumeQueue = useCallback(() => {
    if (!currentChat || !currentChat.queuePaused) return

    setQueuePaused(currentChat.id, false)

    setLocalChatState((prev) => ({
      ...prev,
      queuePaused: { ...prev.queuePaused, [currentChat.id]: false },
    }))
  }, [currentChat])

  // =============================================================================
  // Return
  // =============================================================================

  return {
    // State
    chats,
    currentChat,
    currentChatId,
    settings,
    credentialFlags,
    isHydrated,
    isLoading,
    deletingChatIds,
    unseenChatIds,

    // Actions
    startNewChat,
    selectChat,
    removeChat,
    renameChat,
    updateChatRepo,
    updateCurrentChat,
    updateChatById,
    sendMessage,
    stopAgent,
    updateSettings,
    addMessage: addMessageToChat,
    enqueueMessage,
    removeQueuedMessage,
    resumeQueue,
  }
}
