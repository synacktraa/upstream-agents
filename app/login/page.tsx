"use client"

import { signIn } from "next-auth/react"
import { Github, Loader2 } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

function LoginContents() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const forceConsent = searchParams.get("consent") === "1"
  const [checkingDevMode, setCheckingDevMode] = useState(true)

  // Check for dev mode and auto-redirect
  useEffect(() => {
    async function checkDevMode() {
      try {
        const res = await fetch("/api/auth/dev-mode")
        const { enabled } = await res.json()
        if (enabled) {
          // Redirect to dev session endpoint which creates the session
          router.push("/api/auth/dev-session")
          return
        }
      } catch {
        // Ignore errors, just show normal login
      }
      setCheckingDevMode(false)
    }
    checkDevMode()
  }, [router])

  // Show loading while checking dev mode
  if (checkingDevMode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 p-8">
        <div className="flex h-16 w-32 items-center justify-center rounded-2xl bg-secondary">
          <pre className="m-0 whitespace-pre text-center font-mono text-xl font-bold leading-none text-primary">
            {"<°))><"}
          </pre>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold text-foreground">Upstream Agents</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Run AI coding agents in isolated sandboxes connected to your GitHub repositories
          </p>
        </div>

        <button
          onClick={() =>
            signIn(
              "github",
              { callbackUrl: "/" },
              forceConsent ? { prompt: "consent" } : undefined
            )
          }
          className="flex cursor-pointer items-center gap-3 rounded-lg bg-[#24292f] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#24292f]/90"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Sign in with GitHub
        </button>

        {forceConsent && (
          <p className="text-xs text-muted-foreground max-w-sm text-center">
            Re-authorization enabled (requested via <span className="font-mono">?consent=1</span>).
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          We&apos;ll request access to your repositories for the agent to work with
        </p>

        <a
          href="https://github.com/jamesmurdza/upstream-agents"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Github className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
          View on GitHub
        </a>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-background" />
      }
    >
      <LoginContents />
    </Suspense>
  )
}

