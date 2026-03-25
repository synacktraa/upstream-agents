import { prisma } from "@/lib/prisma"
import { decryptUserCredentials } from "@/lib/api-helpers"
import { generateText } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const OPENROUTER_FREE_MODEL = "stepfun/step-3.5-flash:free"

export interface LLMGenerateOptions {
  userId: string
  prompt: string
}

export interface LLMGenerateResult {
  text: string | null
  error: "no_api_key" | "llm_error" | null
}

/**
 * Generates text using OpenRouter's free model (stepfun/step-3.5-flash:free).
 * This is used as a fallback when users don't have their own API keys configured.
 *
 * @returns The generated text, or null if generation failed.
 */
async function generateWithOpenRouter(prompt: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY) {
    console.log("[generateWithOpenRouter] No OpenRouter API key configured")
    return null
  }

  try {
    console.log("[generateWithOpenRouter] Using OpenRouter with model:", OPENROUTER_FREE_MODEL)

    // Use createOpenAI with OpenRouter's base URL (OpenRouter is OpenAI-compatible)
    const openrouter = createOpenAI({
      apiKey: OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
    })

    const result = await generateText({
      model: openrouter(OPENROUTER_FREE_MODEL),
      prompt,
    })

    return result.text.trim()
  } catch (error) {
    console.error("[generateWithOpenRouter] Error:", error)
    return null
  }
}

/**
 * Generates text using the user's configured LLM (Anthropic preferred, OpenAI fallback).
 * If no user API keys are available, falls back to OpenRouter's free model.
 * Uses fast models (Claude Haiku / GPT-4o-mini) for low latency.
 *
 * @returns The generated text, or null with an error reason if generation failed.
 */
export async function generateWithUserLLM(
  options: LLMGenerateOptions
): Promise<LLMGenerateResult> {
  const { userId, prompt } = options

  try {
    // Get user's API keys
    const userCredentials = await prisma.userCredentials.findUnique({
      where: { userId },
    })
    const { anthropicApiKey, openaiApiKey } = decryptUserCredentials(userCredentials)

    // If no user API keys available, try OpenRouter as fallback
    if (!anthropicApiKey && !openaiApiKey) {
      console.log("[generateWithUserLLM] No user API keys found, trying OpenRouter fallback")

      const openRouterResult = await generateWithOpenRouter(prompt)
      if (openRouterResult) {
        return { text: openRouterResult, error: null }
      }

      // No API keys at all
      console.log("[generateWithUserLLM] No API keys available (user or OpenRouter)")
      return { text: null, error: "no_api_key" }
    }

    console.log("[generateWithUserLLM] Using:", anthropicApiKey ? "Anthropic" : "OpenAI")

    let text: string

    if (anthropicApiKey) {
      // Prefer Anthropic (Claude) - use haiku for speed
      const anthropic = createAnthropic({ apiKey: anthropicApiKey })
      const result = await generateText({
        model: anthropic("claude-3-haiku-20240307"),
        prompt,
      })
      text = result.text.trim()
    } else {
      // Fallback to OpenAI - use gpt-4o-mini for speed
      const openai = createOpenAI({ apiKey: openaiApiKey! })
      const result = await generateText({
        model: openai("gpt-4o-mini"),
        prompt,
      })
      text = result.text.trim()
    }

    return { text, error: null }
  } catch (error) {
    console.error("[generateWithUserLLM] Error:", error)
    return { text: null, error: "llm_error" }
  }
}

/**
 * Check if LLM generation is available for a user.
 * Returns true if the user has their own API keys OR if OpenRouter is configured as fallback.
 */
export async function hasUserLLMKey(userId: string): Promise<boolean> {
  // Check if OpenRouter is configured as server-wide fallback
  if (OPENROUTER_API_KEY) {
    return true
  }

  // Check user's personal API keys
  const userCredentials = await prisma.userCredentials.findUnique({
    where: { userId },
  })
  const { anthropicApiKey, openaiApiKey } = decryptUserCredentials(userCredentials)
  return !!(anthropicApiKey || openaiApiKey)
}

/**
 * Check if OpenRouter is configured for server-wide fallback.
 */
export function hasOpenRouterKey(): boolean {
  return !!OPENROUTER_API_KEY
}
