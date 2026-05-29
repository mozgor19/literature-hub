"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, Copy, FolderPlus, Check } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { AddToProjectDialog } from "@/components/projects/AddToProjectDialog"
import { formatYear, truncate } from "@/lib/utils"
import type { ArticleWithRelations } from "@/types/database"

interface Props {
  articles: ArticleWithRelations[]
  isLoading: boolean
  total: number
  page: number
  limit: number
  onPageChange: (p: number) => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy} title="Bağlantıyı kopyala">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

export function ArticleTable({ articles, isLoading, total, page, limit, onPageChange }: Props) {
  const [projectDialog, setProjectDialog] = useState<{ articleId: string; title: string } | null>(null)
  const totalPages = Math.ceil(total / limit)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
        <p className="text-lg font-medium">Makale bulunamadı</p>
        <p className="text-sm">Filtreleri değiştirin veya yeni makale ekleyin</p>
        <Button asChild className="mt-2" variant="outline">
          <Link href="/articles/new">+ Makale Ekle</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {total} makaleden {(page - 1) * limit + 1}–{Math.min(page * limit, total)} arası gösteriliyor
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">Başlık / Yazarlar</TableHead>
              <TableHead className="w-[8%]">Yıl</TableHead>
              <TableHead className="w-[14%]">Alan</TableHead>
              <TableHead className="w-[20%]">Etiketler</TableHead>
              <TableHead className="w-[10%]">Ekleyen</TableHead>
              <TableHead className="w-[13%] text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => {
              const field = article.field as { name: string; parent?: { name: string } | null } | null
              const fieldPath = field
                ? field.parent
                  ? `${field.parent.name} / ${field.name}`
                  : field.name
                : "—"
              const addedBy = article.added_by_user as { name: string | null; email: string } | null

              return (
                <TableRow key={article.id}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm leading-snug">
                        {article.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {truncate(article.authors, 60)}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell className="text-sm">{formatYear(article.year)}</TableCell>

                  <TableCell>
                    <span className="text-xs text-muted-foreground">{fieldPath}</span>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(article.tags ?? []).slice(0, 3).map((tag) => (
                        <Badge key={(tag as { id: string }).id} variant="secondary" className="text-xs px-1.5 py-0">
                          {(tag as { name: string }).name}
                        </Badge>
                      ))}
                      {(article.tags ?? []).length > 3 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          +{(article.tags ?? []).length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {addedBy?.name ?? addedBy?.email ?? "—"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {article.project_count > 0 && (
                        <Badge variant="outline" className="text-xs px-1.5 h-6">
                          {article.project_count}P
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Projeye ekle"
                        onClick={() => setProjectDialog({ articleId: article.id, title: article.title })}
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                      </Button>
                      <CopyButton text={article.drive_web_link} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Drive'da aç">
                        <a href={article.drive_web_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Önceki
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Sonraki
          </Button>
        </div>
      )}

      {projectDialog && (
        <AddToProjectDialog
          articleId={projectDialog.articleId}
          articleTitle={projectDialog.title}
          open={true}
          onOpenChange={(open) => !open && setProjectDialog(null)}
        />
      )}
    </div>
  )
}
