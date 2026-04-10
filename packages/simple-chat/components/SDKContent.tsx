"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SDKContentProps {
  isMobile?: boolean
}

function CopyButton({ text, isMobile = false }: { text: string; isMobile?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "absolute rounded-md bg-muted/50 hover:bg-muted active:bg-muted text-muted-foreground hover:text-foreground transition-colors touch-target",
        isMobile ? "top-3 right-3 p-2" : "top-2 right-2 p-1.5"
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
      ) : (
        <Copy className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
      )}
    </button>
  )
}

function CodeBlock({ children, isMobile = false }: { children: string; isMobile?: boolean }) {
  return (
    <div className="relative group">
      <pre className={cn(
        "bg-muted/50 rounded-lg overflow-x-auto mobile-scroll font-mono",
        isMobile ? "p-4 text-sm" : "p-4 text-sm"
      )}>
        <code>{children}</code>
      </pre>
      <CopyButton text={children} isMobile={isMobile} />
    </div>
  )
}

function Endpoint({
  method,
  path,
  description,
  requestBody,
  response,
  children,
  isMobile = false,
}: {
  method: "GET" | "POST" | "DELETE"
  path: string
  description: string
  requestBody?: string
  response: string
  children?: React.ReactNode
  isMobile?: boolean
}) {
  const methodColors = {
    GET: "bg-green-500/20 text-green-600 dark:text-green-400",
    POST: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    DELETE: "bg-red-500/20 text-red-600 dark:text-red-400",
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className={cn(
        "flex items-start gap-3 bg-muted/30",
        isMobile ? "flex-col p-4" : "flex-row items-center p-4"
      )}>
        <span className={cn(
          "px-2 py-1 rounded text-xs font-semibold shrink-0",
          methodColors[method]
        )}>
          {method}
        </span>
        <code className={cn(
          "font-mono break-all",
          isMobile ? "text-sm" : "text-sm"
        )}>
          {path}
        </code>
      </div>
      <div className={cn(
        isMobile ? "p-4 space-y-4" : "p-4 space-y-4"
      )}>
        <p className={cn(
          "text-muted-foreground",
          isMobile ? "text-base" : "text-sm"
        )}>
          {description}
        </p>

        {requestBody && (
          <div>
            <h4 className={cn(
              "font-semibold mb-2",
              isMobile ? "text-base" : "text-sm"
            )}>
              Request Body
            </h4>
            <CodeBlock isMobile={isMobile}>{requestBody}</CodeBlock>
          </div>
        )}

        {children}

        <div>
          <h4 className={cn(
            "font-semibold mb-2",
            isMobile ? "text-base" : "text-sm"
          )}>
            Response
          </h4>
          <CodeBlock isMobile={isMobile}>{response}</CodeBlock>
        </div>
      </div>
    </div>
  )
}

export function SDKContent({ isMobile = false }: SDKContentProps) {
  return (
    <div className="flex-1 overflow-y-auto mobile-scroll bg-background">
      <div className={cn(
        "mx-auto",
        isMobile ? "px-4 py-6 max-w-full" : "px-6 py-12 max-w-4xl"
      )}>
        {/* Header */}
        <div className={cn(isMobile ? "mb-6" : "mb-8")}>
          <h1 className={cn(
            "font-bold",
            isMobile ? "text-2xl" : "text-3xl"
          )}>
            REST API Reference
          </h1>
          <p className={cn(
            "text-muted-foreground mt-2",
            isMobile ? "text-base" : "text-sm"
          )}>
            Use this API to programmatically create sandboxes, run agents, and push changes.
          </p>
        </div>

        {/* Endpoints */}
        <section className="space-y-6">
          {/* Create Sandbox */}
          <Endpoint
            method="POST"
            path="/api/sandbox/create"
            description="Create a new sandbox, clone a GitHub repository, and checkout a new branch."
            requestBody={`{
  "repo": "owner/repo",
  "baseBranch": "main",
  "newBranch": "ai/feature",
  "githubToken": "ghp_xxxx"
}`}
            response={`{
  "sandboxId": "sandbox_abc123",
  "repoName": "repo",
  "branch": "ai/feature",
  "previewUrlPattern": "https://{port}-xxx.daytonaproxy.net"
}`}
            isMobile={isMobile}
          />

          {/* Execute Agent */}
          <Endpoint
            method="POST"
            path="/api/agent/execute"
            description="Start an agent to execute a task in the sandbox."
            requestBody={`{
  "sandboxId": "sandbox_abc123",
  "repoName": "repo",
  "prompt": "Add a README.md",
  "agent": "opencode",
  "model": "anthropic/claude-sonnet-4-20250514",
  "anthropicApiKey": "sk-ant-xxxx",
  "openaiApiKey": "sk-xxxx"
}`}
            response={`{
  "backgroundSessionId": "ses_xyz789",
  "status": "running"
}`}
            isMobile={isMobile}
          >
            <div>
              <h4 className={cn(
                "font-semibold mb-2",
                isMobile ? "text-base" : "text-sm"
              )}>
                Supported Agents
              </h4>
              <div className="overflow-x-auto mobile-scroll -mx-4 px-4">
                <table className={cn(
                  "w-full min-w-[500px]",
                  isMobile ? "text-sm" : "text-xs"
                )}>
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium">Agent</th>
                      <th className="text-left py-2 pr-4 font-medium">API Key</th>
                      <th className="text-left py-2 font-medium">Models</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-muted-foreground">
                    <tr>
                      <td className="py-2 pr-4 font-mono text-foreground">opencode</td>
                      <td className="py-2 pr-4">Optional</td>
                      <td className="py-2 font-mono">anthropic/claude-sonnet-4-20250514, openai/gpt-4.1</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono text-foreground">claude-code</td>
                      <td className="py-2 pr-4">anthropicApiKey</td>
                      <td className="py-2 font-mono">claude-sonnet-4-20250514, claude-opus-4-20250514</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono text-foreground">codex</td>
                      <td className="py-2 pr-4">openaiApiKey</td>
                      <td className="py-2 font-mono">o3, gpt-4.1</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono text-foreground">gemini</td>
                      <td className="py-2 pr-4">geminiApiKey</td>
                      <td className="py-2 font-mono">gemini-2.5-pro</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono text-foreground">goose</td>
                      <td className="py-2 pr-4">anthropicApiKey or openaiApiKey</td>
                      <td className="py-2 font-mono">claude-sonnet-4-20250514, gpt-4.1</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono text-foreground">pi</td>
                      <td className="py-2 pr-4">anthropicApiKey, openaiApiKey, or geminiApiKey</td>
                      <td className="py-2 font-mono">sonnet, openai/gpt-4.1</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Endpoint>

          {/* Poll Status */}
          <Endpoint
            method="GET"
            path="/api/agent/status?sandboxId=...&repoName=..."
            description="Poll for agent execution status and output."
            response={`{
  "status": "running" | "completed" | "error",
  "content": "I'll create a README file...",
  "toolCalls": [
    { "tool": "Write", "summary": "README.md", "output": "..." }
  ],
  "contentBlocks": [...],
  "error": null
}`}
            isMobile={isMobile}
          />

          {/* Push */}
          <Endpoint
            method="POST"
            path="/api/git/push"
            description="Push committed changes to the remote GitHub repository."
            requestBody={`{
  "sandboxId": "sandbox_abc123",
  "repoName": "repo",
  "branch": "ai/feature",
  "githubToken": "ghp_xxxx"
}`}
            response={`{ "success": true }`}
            isMobile={isMobile}
          />

          {/* Delete Sandbox */}
          <Endpoint
            method="POST"
            path="/api/sandbox/delete"
            description="Delete a sandbox and clean up resources."
            requestBody={`{ "sandboxId": "sandbox_abc123" }`}
            response={`{ "success": true }`}
            isMobile={isMobile}
          />
        </section>
      </div>
    </div>
  )
}
