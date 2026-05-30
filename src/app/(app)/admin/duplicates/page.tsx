"use client"

import { useSession } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ExternalLink, AlertTriangle, Loader2, Trash2, ArrowLeft, RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip } from "@/components/ui/tooltip"
import { formatYear, truncate } from "@/lib/utils"
import type { DuplicateGroup } from "@/app/api/articles/duplicates/route"

interface DeleteState { articleId: string; title: string; step: 1 | 2 }

export default function AdminDuplicatesPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [deleteDialog, setDeleteDialog] = useState<DeleteState | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery<{ groups: DuplicateGroup[] }>({
    queryKey: ["admin-duplicates"],
    queryFn: () => fetch("/api/articles/duplicates").then((r) => r.json()),
    enabled: !!session?.user?.isAdmin,
  })

  // ── Guard: admin-only ────────────────────────────────────────────────────
  if (session && !session.user?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
        <AlertTriangle className="h-8 w-8" />
        <p className="font-medium">Bu sayfaya erişim yetkiniz yok.</p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/articles">Makale Listesine Dön</Link>
        </Button>
      </div>
    )
  }

  // ── Delete — reuses existing DELETE /api/articles/[id] route ────────────
  const handleDelete = async () => {
    if (!deleteDialog) return
    setDeleting(deleteDialog.articleId)
    try {
      const res = await fetch(`/api/articles/${deleteDialog.articleId}`, { method: "DELETE" })
      const raw = await res.text()
      const body = raw ? JSON.parse(raw) as { error?: string; driveDeleted?: boolean; warning?: string } : null
      if (!res.ok) throw new Error(body?.error ?? "Silinemedi")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["articles"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-duplicates"] }),
      ])
      if (body?.driveDeleted === false) toast.warning(body.warning ?? "Kayıt silindi ama Drive dosyası kaldırılamadı")
      else toast.success("Makale ve Drive PDF'i silindi")
      setDeleteDialog(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silme başarısız")
    } finally {
      setDeleting(null)
    }
  }

  const groups = data?.groups ?? []

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/articles">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Makale Listesi
          </Link>
        </Button>
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Olası Tekrarlar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Yalnızca raporlama. Silme işlemi mevcut izin kurallarını kullanır (sahip veya admin).
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Yenile
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2 rounded-xl border">
          <p className="font-medium">Olası tekrar bulunamadı.</p>
          <p className="text-sm">Kütüphane temiz görünüyor.</p>
        </div>
      )}

      {/* Groups */}
      {groups.map((group, gi) => (
        <div key={gi} className="rounded-xl border bg-card overflow-hidden">
          {/* Group header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
            <Badge
              variant="outline"
              className={`text-xs font-semibold ${
                group.match_type === "doi"
                  ? "border-red-300 text-red-700 bg-red-50"
                  : "border-amber-300 text-amber-700 bg-amber-50"
              }`}
            >
              {group.match_type === "doi"
                ? "Aynı DOI"
                : `Benzer başlık — ${Math.round(group.similarity * 100)}%`}
            </Badge>
            <span className="text-xs text-muted-foreground">{group.articles.length} makale</span>
          </div>

          {/* Articles in group */}
          <div className="divide-y">
            {group.articles.map((article) => {
              const canDelete = session?.user?.isAdmin
              return (
                <div key={article.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <Link
                      href={`/articles/${article.id}`}
                      className="font-medium text-sm leading-snug hover:underline"
                    >
                      {article.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {truncate(article.authors, 80)}{article.year ? ` · ${formatYear(article.year)}` : ""}
                    </p>
                    {article.source_url && (
                      <p className="text-xs text-muted-foreground/70 truncate">{article.source_url}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip content="Drive'da aç">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={article.drive_web_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </Tooltip>
                    {canDelete && (
                      <Tooltip content="Makaleyi sil">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteDialog({ articleId: article.id, title: article.title, step: 1 })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Delete confirmation — same two-step pattern as ArticleTable */}
      <Dialog
        open={deleteDialog !== null}
        onOpenChange={(open) => { if (!open && !deleting) setDeleteDialog(null) }}
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
                    ? `"${truncate(deleteDialog.title, 80)}" kaydını silmek üzeresiniz.`
                    : "Bu işlem geri alınamaz. Makale kaydı ve Drive PDF'i kalıcı olarak silinir."}
                </DialogDescription>
              </DialogHeader>
              {deleteDialog.step === 2 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Silme işlemi tamamlandığında proje bağlantıları da kaldırılır.</p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={!!deleting}>
                  Vazgeç
                </Button>
                {deleteDialog.step === 1 ? (
                  <Button variant="destructive" onClick={() => setDeleteDialog({ ...deleteDialog, step: 2 })}>
                    Devam et
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={handleDelete} disabled={!!deleting}>
                    {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
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
