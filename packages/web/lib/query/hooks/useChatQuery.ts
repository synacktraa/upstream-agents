"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { queryKeys } from "../keys"
import { fetchChat, toChatType, toMessageType } from "@/lib/sync/api"
import type { Chat } from "@/lib/types"

/**
 * Fetches a single chat with its messages.
 * Only enabled when authenticated and chatId is provided.
 */
export function useChatQuery(chatId: string | null) {
  const { data: session, status } = useSession()
  const isAuthenticated = status === "authenticated" && !!session?.user?.id

  return useQuery({
    queryKey: queryKeys.chats.detail(chatId ?? ""),
    queryFn: async (): Promise<Chat> => {
      if (!chatId) throw new Error("No chat ID provided")
      const chatData = await fetchChat(chatId)
      return {
        ...toChatType(chatData),
        messages: chatData.messages.map(toMessageType),
      }
    },
    enabled: isAuthenticated && !!chatId,
    staleTime: 30 * 1000,
  })
}

/**
 * Prefetch a chat for faster navigation
 */
export function usePrefetchChat() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  return async (chatId: string) => {
    if (!session?.user?.id || !chatId) return

    await queryClient.prefetchQuery({
      queryKey: queryKeys.chats.detail(chatId),
      queryFn: async () => {
        const chatData = await fetchChat(chatId)
        return {
          ...toChatType(chatData),
          messages: chatData.messages.map(toMessageType),
        }
      },
    })
  }
}

/**
 * Get cached chat data without triggering a fetch
 */
export function useCachedChat(chatId: string | null) {
  const queryClient = useQueryClient()

  if (!chatId) return null

  return queryClient.getQueryData<Chat>(queryKeys.chats.detail(chatId))
}
