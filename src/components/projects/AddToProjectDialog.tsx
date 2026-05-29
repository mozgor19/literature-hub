"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Plus, FolderOpen } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import type { DBProject } from "@/types/database"

interface Props {
  articleId: string
  articleTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddToProjectDialog({ articleId, articleTitle, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [creating, setCreating] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)

  const { data: projects = [] } = useQuery<(DBProject & { article_count: number })[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
    enabled: open,
  })

  const addToProject = async (projectId: string) => {
    setAdding(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article_id: articleId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast.success("Makale projeye eklendi")
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      onOpenChange(false)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setAdding(null)
    }
  }

  const createAndAdd = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      })
      const proj = await res.json()
      if (!res.ok) throw new Error(proj.error)
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      await addToProject(proj.id)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Projeye Ekle</DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{articleTitle}</p>
        </DialogHeader>

        {!showCreate ? (
          <>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Henüz proje yok.
              </p>
            ) : (
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addToProject(p.id)}
                      disabled={adding !== null}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                    >
                      <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {p.article_count} makale
                      </span>
                      {adding === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Separator />
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" />
              Yeni Proje Oluştur ve Ekle
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Proje Adı</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Proje adı..."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Açıklama (isteğe bağlı)</Label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Proje açıklaması..."
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Geri
              </Button>
              <Button onClick={createAndAdd} disabled={creating || !newName.trim()}>
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Oluştur ve Ekle
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
