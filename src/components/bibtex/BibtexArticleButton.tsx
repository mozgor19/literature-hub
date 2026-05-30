"use client"

import { useState } from "react"
import { BookMarked } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BibtexDialog } from "./BibtexDialog"
import { articlesToBibtex, type ArticleForBibtex } from "@/lib/bibtex"

export function BibtexArticleButton({ article }: { article: ArticleForBibtex }) {
  const [open, setOpen] = useState(false)

  const bibtex = articlesToBibtex([article])
  const filename =
    article.title
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_") + ".bib"

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BookMarked className="h-3.5 w-3.5 mr-1.5" />
        BibTeX
      </Button>
      <BibtexDialog
        bibtex={bibtex}
        filename={filename}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
