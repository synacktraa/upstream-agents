"use client"

import { Globe } from "lucide-react"
import type { PanelPlugin, PanelProps, PreviewItem } from "../types"

function ServerPreviewComponent({ item }: PanelProps) {
  const url = item.type === "server" ? item.url : ""

  return (
    <iframe
      src={url}
      className="h-full w-full border-0 bg-white"
      title="Live preview"
    />
  )
}

export const ServerPreviewPlugin: PanelPlugin = {
  id: "server-preview",

  canHandle: (item: PreviewItem) => item.type === "server",

  getLabel: (item: PreviewItem) => {
    if (item.type === "server") {
      return `:${item.port}`
    }
    return "Preview"
  },

  getIcon: () => Globe,

  Component: ServerPreviewComponent,
}
