"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { toast } from "sonner"
import { ExternalLink, Copy, X, ArrowLeft, Check, Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { formatYear, truncate, formatDate } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip"

interface ProjectArticle {
  id: string
  title: string
  authors: string
  year: number | null
  drive_web_link: string
  drive_folder_path: string
  field: { id: string; name: string; parent_id: string | null } | null
  tags: Array<{ id: string; name: string }>
  added_to_project_at: string
}

interface ProjectData {
  id: string
  name: string
  description: string | null
  created_at: string
  created_by_user: { name: string | null; email: string } | null
  articles: ProjectArticle[]
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Tooltip content={copied ? "Kopyalandı!" : "Drive bağlantısını kopyala"}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={async () => {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </Tooltip>
  )
}

export function ProjectDetail({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const { data: project, isLoading } = useQuery<ProjectData>({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  })

  const removeArticle = async (articleId: string, articleTitle: string) => {
    if (!confirm(`"${truncate(articleTitle, 50)}" makalesini bu projeden çıkarmak istiyor musunuz?`)) return
    setRemoving(articleId)
    try {
      const res = await fetch(
        `/api/projects/${id}/articles?article_id=${articleId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Makale çıkarılamadı")
      queryClient.invalidateQueries({ queryKey: ["project", id] })
      toast.success("Makale projeden çıkarıldı")
    } catch (err) {
      toast.error(String(err))
    } finally {
      setRemoving(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Proje bulunamadı.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/projects">Projelere Dön</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Projeler
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4" />
            Projeyi Sil
          </Button>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        {project.description && (
          <p className="text-muted-foreground mt-1">{project.description}</p>
        )}
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span>{project.articles.length} makale</span>
          <span>Oluşturan: {project.created_by_user?.name ?? project.created_by_user?.email}</span>
          <span>{formatDate(project.created_at)}</span>
        </div>
      </div>

      {/* Articles */}
      {project.articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2 rounded-xl border">
          <p className="font-medium">Bu projede henüz makale yok</p>
          <p className="text-sm">Makale listesinden buraya makale ekleyebilirsiniz</p>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/">Makale Listesine Git</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {project.articles.map((article) => (
              <div key={article.id} className="rounded-lg border bg-card p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-snug flex-1">{article.title}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{formatYear(article.year)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{truncate(article.authors, 60)}</p>
                <p className="text-xs text-muted-foreground">{article.drive_folder_path}</p>
                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {article.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="text-xs px-1.5 py-0">{tag.name}</Badge>
                    ))}
                    {article.tags.length > 4 && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">+{article.tags.length - 4}</Badge>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-end gap-1 pt-1">
                  <Tooltip content="Drive'da aç">
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={article.drive_web_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </Tooltip>
                  <Tooltip content="Projeden çıkar">
                    <Button variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeArticle(article.id, article.title)} disabled={removing === article.id}>
                      {removing === article.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    </Button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[38%]">Başlık / Yazarlar</TableHead>
                  <TableHead className="w-[8%]">Yıl</TableHead>
                  <TableHead className="w-[16%]">Alan</TableHead>
                  <TableHead className="w-[20%]">Etiketler</TableHead>
                  <TableHead className="w-[12%] text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.articles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm leading-snug">{article.title}</p>
                        <p className="text-xs text-muted-foreground">{truncate(article.authors, 60)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatYear(article.year)}</TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{article.drive_folder_path}</span></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {article.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag.id} variant="secondary" className="text-xs px-1.5 py-0">{tag.name}</Badge>
                        ))}
                        {article.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">+{article.tags.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <CopyBtn text={article.drive_web_link} />
                        <Tooltip content="Drive'da aç">
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={article.drive_web_link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </Tooltip>
                        <Tooltip content="Projeden çıkar">
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeArticle(article.id, article.title)} disabled={removing === article.id}>
                            {removing === article.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <DeleteProjectDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        projectId={id}
        projectName={project.name}
        redirectToProjects={true}
      />
    </div>
  )
}
