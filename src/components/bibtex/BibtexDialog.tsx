"use client"

import { useState } from "react"
import { Copy, Check, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  bibtex: string
  filename?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BibtexDialog({
  bibtex,
  filename = "export.bib",
  open,
  onOpenChange,
}: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(bibtex)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([bibtex], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>BibTeX</DialogTitle>
        </DialogHeader>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-96 whitespace-pre font-mono select-all">
          {bibtex}
        </pre>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4 mr-1.5 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-1.5" />
            )}
            {copied ? "Kopyalandı!" : "Kopyala"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1.5" />
            İndir (.bib)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
