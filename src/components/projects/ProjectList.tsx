"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Loader2, FolderOpen, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"
import type { DBProject } from "@/types/database"

type ProjectWithCount = DBProject & { article_count: number }

export function ProjectList() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data: projects = [], isLoading } = useQuery<ProjectWithCount[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  })

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await queryClient.invalidateQueries({ queryKey: ["projects"] })
      setShowCreate(false)
      setName("")
      setDesc("")
      toast.success(`"${data.name}" projesi oluşturuldu`)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, projectName: string) => {
    if (!confirm(`"${projectName}" projesini silmek istediğinize emin misiniz? Makaleler silinmez.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Proje silinemedi")
      await queryClient.invalidateQueries({ queryKey: ["projects"] })
      toast.success("Proje silindi")
    } catch (err) {
      toast.error(String(err))
    } finally {
      setDeleting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Create new card */}
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="group flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-input bg-card p-8 text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[144px]"
        >
          <Plus className="h-8 w-8" />
          <span className="text-sm font-medium">Yeni Proje</span>
        </button>

        {projects.map((project) => (
          <Card key={project.id} className="group relative hover:shadow-md transition-shadow">
            <Link href={`/projects/${project.id}`} className="block">
              <CardHeader>
                <div className="flex items-start gap-2">
                  <FolderOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {project.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {project.article_count} makale
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(project.created_at)}
                  </span>
                </div>
              </CardContent>
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                handleDelete(project.id, project.name)
              }}
              disabled={deleting === project.id}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Projeyi sil"
            >
              {deleting === project.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Yeni Proje Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Proje Adı</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Proje adı..."
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Açıklama (isteğe bağlı)</Label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Proje açıklaması..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              İptal
            </Button>
            <Button onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
