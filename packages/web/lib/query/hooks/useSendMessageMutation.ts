"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { nanoid } from "nanoid"
import { queryKeys } from "../keys"
import { generateBranchName } from "@/lib/utils"
import type { Chat, Message } from "@/lib/types"

export interface SendMessageParams {
  chatId: string
  content: string
  agent: string
  model: string
  files?: File[]
  /** If sandbox doesn't exist yet, we need to create a branch */
  needsNewBranch?: boolean
}

export interface SendMessageResult {
  sandboxId: string
  branch: string | null
  previewUrlPattern: string | null
  backgroundSessionId: string
  uploadedFiles: string[]
  userMessageId: string
  assistantMessageId: string
}

/**
 * Sends a message to a chat.
 * Handles sandbox creation, file uploads, and initiates the agent.
 *
 * Note: This mutation handles the API call and optimistic updates.
 * SSE streaming should be started by the caller after this succeeds.
 */
export function useSendMessageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: SendMessageParams): Promise<SendMessageResult> => {
      const { chatId, content, agent, model, files, needsNewBranch } = params

      const userMessageId = nanoid()
      const assistantMessageId = nanoid()

      const payload = {
        message: content,
        agent,
        model,
        userMessageId,
        assistantMessageId,
        newBranch: needsNewBranch ? `agent/${generateBranchName()}` : undefined,
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

      const data = await response.json()
      return {
        ...data,
        userMessageId,
        assistantMessageId,
      }
    },
    onMutate: async (params) => {
      const { chatId, content } = params

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chats.detail(chatId) })

      // Snapshot previous value
      const previousChat = queryClient.getQueryData<Chat>(
        queryKeys.chats.detail(chatId)
      )

      // Create optimistic messages
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content,
        timestamp: Date.now(),
      }
      const assistantMessage: Message = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: Date.now() + 1,
        toolCalls: [],
        contentBlocks: [],
      }

      // Optimistically update the chat
      if (previousChat) {
        queryClient.setQueryData<Chat>(queryKeys.chats.detail(chatId), {
          ...previousChat,
          messages: [...previousChat.messages, userMessage, assistantMessage],
          status: previousChat.sandboxId ? "running" : "creating",
          lastActiveAt: Date.now(),
          errorMessage: undefined,
        })

        // Also update the list cache
        queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old = []) =>
          old.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  status: chat.sandboxId ? "running" : "creating",
                  lastActiveAt: Date.now(),
                }
              : chat
          )
        )
      }

      return { previousChat, userMessage, assistantMessage }
    },
    onSuccess: (result, params, context) => {
      const { chatId, agent, model } = params

      // Update the chat with server-confirmed data
      queryClient.setQueryData<Chat>(queryKeys.chats.detail(chatId), (old) => {
        if (!old) return old

        // Replace temp message IDs with real ones
        const messages = old.messages.map((m) => {
          if (m.id === context?.userMessage.id) {
            return {
              ...m,
              id: result.userMessageId,
              uploadedFiles: result.uploadedFiles.length > 0 ? result.uploadedFiles : undefined,
            }
          }
          if (m.id === context?.assistantMessage.id) {
            return { ...m, id: result.assistantMessageId }
          }
          return m
        })

        return {
          ...old,
          messages,
          sandboxId: result.sandboxId,
          branch: result.branch,
          previewUrlPattern: result.previewUrlPattern ?? undefined,
          backgroundSessionId: result.backgroundSessionId,
          agent,
          model,
          status: "running",
        }
      })
    },
    onError: (err, params, context) => {
      const { chatId } = params

      // Rollback to previous state
      if (context?.previousChat) {
        queryClient.setQueryData(queryKeys.chats.detail(chatId), context.previousChat)
      }

      // Update list cache to reflect error
      queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old = []) =>
        old.map((chat) =>
          chat.id === chatId
            ? { ...chat, status: "error", errorMessage: err.message }
            : chat
        )
      )

      console.error("Failed to send message:", err)
    },
  })
}
