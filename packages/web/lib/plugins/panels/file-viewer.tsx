"use client"

import { useEffect, useState } from "react"
import hljs from "highlight.js/lib/common"
import { FileCode2, Loader2 } from "lucide-react"
import type { PanelPlugin, PanelProps, PreviewItem } from "../types"

// Map file extensions to highlight.js language names. Unknown extensions fall
// back to auto-detection.
const EXT_TO_LANG: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  json: "json", jsonc: "json",
  html: "xml", htm: "xml", xml: "xml", svg: "xml", vue: "xml",
  css: "css", scss: "scss", sass: "scss", less: "less",
  py: "python", rb: "ruby", go: "go", rs: "rust",
  java: "java", kt: "kotlin", swift: "swift", scala: "scala",
  c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp", hh: "cpp",
  cs: "csharp", php: "php",
  sh: "bash", bash: "bash", zsh: "bash", fish: "bash",
  yml: "yaml", yaml: "yaml", toml: "ini", ini: "ini",
  md: "markdown", markdown: "markdown",
  sql: "sql", dockerfile: "dockerfile",
  r: "r", lua: "lua", pl: "perl", dart: "dart",
  diff: "diff", patch: "diff",
}

function detectLang(filePath: string): string | null {
  const name = filePath.split("/").pop()?.toLowerCase() ?? ""
  if (name === "dockerfile") return "dockerfile"
  if (name === "makefile") return "makefile"
  const dot = name.lastIndexOf(".")
  if (dot < 0) return null
  return EXT_TO_LANG[name.slice(dot + 1)] ?? null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function HighlightedCode({ code, filePath }: { code: string; filePath: string }) {
  const lines = code.split("\n").map((_, i) => i)
  const lang = detectLang(filePath)
  let html: string
  try {
    if (lang && hljs.getLanguage(lang)) {
      html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } else {
      html = hljs.highlightAuto(code).value
    }
  } catch {
    html = escapeHtml(code)
  }
  const lineHtmls = html.split("\n")
  return (
    <div className="h-full overflow-auto hljs-scope">
      <table className="w-full text-xs font-mono border-collapse">
        <tbody>
          {lines.map((i) => (
            <tr key={i} className="leading-5">
              <td className="select-none text-right text-muted-foreground/50 pr-3 pl-3 align-top w-1 whitespace-nowrap">
                {i + 1}
              </td>
              <td
                className="pr-3 whitespace-pre-wrap break-all"
                dangerouslySetInnerHTML={{ __html: lineHtmls[i] ?? "" }}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FileViewerComponent({ item, sandboxId }: PanelProps) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const filePath = item.type === "file" ? item.filePath : ""

  useEffect(() => {
    if (!sandboxId) {
      setError("No sandbox.")
      setLoading(false)
      return
    }
    if (!filePath) {
      setError("No file path.")
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch("/api/sandbox/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandboxId, action: "read-file", filePath }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || `Failed to load ${filePath}`)
          setContent(null)
        } else {
          setContent(typeof data.content === "string" ? data.content : "")
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sandboxId, filePath])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1 p-4 text-sm text-destructive">
        <div>{error}</div>
      </div>
    )
  }
  return <HighlightedCode code={content ?? ""} filePath={filePath} />
}

export const FileViewerPlugin: PanelPlugin = {
  id: "file-viewer",

  canHandle: (item: PreviewItem) => item.type === "file",

  getLabel: (item: PreviewItem) => {
    if (item.type === "file") {
      return item.filename
    }
    return "File"
  },

  getIcon: () => FileCode2,

  Component: FileViewerComponent,
}
