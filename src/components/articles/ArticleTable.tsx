"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { ExternalLink, Copy, FolderPlus, Check, Trash2, AlertTriangle, Loader2, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
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
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [projectDialog, setProjectDialog] = useState<{ articleId: string; title: string } | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ articleId: string; title: string; step: 1 | 2 } | null>(null)
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null)
  const totalPages = Math.ceil(total / limit)

  const handleDelete = async () => {
    if (!deleteDialog) return

    setDeletingArticleId(deleteDialog.articleId)

    try {
      const res = await fetch(`/api/articles/${deleteDialog.articleId}`, { method: "DELETE" })
      const raw = await res.text()
      const data = raw
        ? JSON.parse(raw) as { error?: string; driveDeleted?: boolean; warning?: string }
        : null

      if (!res.ok) {
        throw new Error(data?.error ?? "Makale silinemedi")
      }

      await queryClient.invalidateQueries({ queryKey: ["articles"] })
      await queryClient.invalidateQueries({ queryKey: ["project"] })
      if (data?.driveDeleted === false) {
        toast.warning(data.warning ?? "Makale kaydı silindi, ancak Drive dosyası silinemedi")
      } else {
        toast.success("Makale ve Drive üzerindeki PDF silindi")
      }
      setDeleteDialog(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Makale silinemedi"
      toast.error(message)
    } finally {
      setDeletingArticleId(null)
    }
  }

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

      {/* ── Mobile card list (< md) ── */}
      <div className="md:hidden space-y-2">
        {articles.map((article) => {
          const field = article.field as { name: string; parent?: { name: string } | null } | null
          const fieldPath = field ? (field.parent ? `${field.parent.name} / ${field.name}` : field.name) : "—"
          const canDeleteArticle = session?.user?.isAdmin || article.added_by === session?.user?.id
          return (
            <div key={article.id} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/articles/${article.id}`} className="font-medium text-sm leading-snug hover:underline flex-1">
                  {article.title}
                </Link>
                <span className="text-xs text-muted-foreground shrink-0">{formatYear(article.year)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{truncate(article.authors, 60)}</p>
              <p className="text-xs text-muted-foreground">{fieldPath}</p>
              {(article.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(article.tags ?? []).slice(0, 4).map((tag) => (
                    <Badge key={(tag as { id: string }).id} variant="secondary" className="text-xs px-1.5 py-0">
                      {(tag as { name: string }).name}
                    </Badge>
                  ))}
                  {(article.tags ?? []).length > 4 && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">+{(article.tags ?? []).length - 4}</Badge>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1 pt-1">
                {article.comment_count > 0 && (
                  <Badge variant="outline" className="text-xs px-1.5 h-6 gap-1">
                    <MessageSquare className="h-3 w-3" />{article.comment_count}
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Projeye ekle"
                    onClick={() => setProjectDialog({ articleId: article.id, title: article.title })}>
                    <FolderPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Drive'da aç">
                    <a href={article.drive_web_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  {canDeleteArticle && (
                    <Button variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Makaleyi sil"
                      onClick={() => setDeleteDialog({ articleId: article.id, title: article.title, step: 1 })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop table (≥ md) ── */}
      <div className="hidden md:block rounded-md border">
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
              const canDeleteArticle =
                session?.user?.isAdmin || article.added_by === session?.user?.id

              return (
                <TableRow key={article.id}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <Link href={`/articles/${article.id}`} className="font-medium text-sm leading-snug hover:underline">
                        {article.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{truncate(article.authors, 60)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatYear(article.year)}</TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">{fieldPath}</span></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(article.tags ?? []).slice(0, 3).map((tag) => (
                        <Badge key={(tag as { id: string }).id} variant="secondary" className="text-xs px-1.5 py-0">
                          {(tag as { name: string }).name}
                        </Badge>
                      ))}
                      {(article.tags ?? []).length > 3 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">+{(article.tags ?? []).length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{addedBy?.name ?? addedBy?.email ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {article.comment_count > 0 && (
                        <Badge variant="outline" className="text-xs px-1.5 h-6 gap-1">
                          <MessageSquare className="h-3 w-3" />{article.comment_count}
                        </Badge>
                      )}
                      {article.project_count > 0 && (
                        <Badge variant="outline" className="text-xs px-1.5 h-6">{article.project_count}P</Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Projeye ekle"
                        onClick={() => setProjectDialog({ articleId: article.id, title: article.title })}>
                        <FolderPlus className="h-3.5 w-3.5" />
                      </Button>
                      <CopyButton text={article.drive_web_link} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Drive'da aç">
                        <a href={article.drive_web_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      {canDeleteArticle && (
                        <Button variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Makaleyi sil"
                          onClick={() => setDeleteDialog({ articleId: article.id, title: article.title, step: 1 })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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

      <Dialog
        open={deleteDialog !== null}
        onOpenChange={(open) => {
          if (!open && deletingArticleId === null) setDeleteDialog(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          {deleteDialog && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {deleteDialog.step === 1 ? "Makaleyi sil?" : "Son onay"}
                </DialogTitle>
                <DialogDescription>
                  {deleteDialog.step === 1
                    ? `"${truncate(deleteDialog.title, 80)}" kaydini silmek üzeresiniz.`
                    : "Bu işlem geri alınamaz. Makale kaydı silinir ve PDF Google Drive üzerinden kalıcı olarak kaldırılır."}
                </DialogDescription>
              </DialogHeader>

              {deleteDialog.step === 2 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Silme işlemi tamamlandığında proje bağlantıları da kaldırılır ve dosyayı
                      geri getirmek mümkün olmaz.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialog(null)}
                  disabled={deletingArticleId !== null}
                >
                  Vazgeç
                </Button>
                {deleteDialog.step === 1 ? (
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialog({ ...deleteDialog, step: 2 })}
                  >
                    Devam et
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deletingArticleId !== null}
                  >
                    {deletingArticleId !== null && <Loader2 className="h-4 w-4 animate-spin" />}
                    Geri alınamaz, sil
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
