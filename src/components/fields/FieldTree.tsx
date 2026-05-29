"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { FolderOpen, FolderClosed, Plus, Loader2, ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { FieldWithChildren } from "@/types/database"

export function FieldTree() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAdminUser = session?.user?.isAdmin ?? false
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showDialog, setShowDialog] = useState(false)
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldParentId, setNewFieldParentId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: fields = [], isLoading } = useQuery<FieldWithChildren[]>({
    queryKey: ["fields"],
    queryFn: () => fetch("/api/fields").then((r) => r.json()),
  })

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const openCreateDialog = (parentId: string | null) => {
    setNewFieldParentId(parentId)
    setNewFieldName("")
    setShowDialog(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" alanını silmek istediğinize emin misiniz? Drive klasörü de silinecek.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/fields/${id}`, { method: "DELETE" })
      const data = await res.json() as { error?: string; warning?: string }
      if (!res.ok) { toast.error(data.error ?? "Silinemedi"); return }
      if (data.warning) toast.warning(data.warning)
      else toast.success(`"${name}" silindi`)
      await queryClient.invalidateQueries({ queryKey: ["fields"] })
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreate = async () => {
    if (!newFieldName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFieldName.trim(), parent_id: newFieldParentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await queryClient.invalidateQueries({ queryKey: ["fields"] })
      if (newFieldParentId) setExpanded((prev) => new Set([...prev, newFieldParentId!]))
      setShowDialog(false)
      toast.success(`"${data.name}" oluşturuldu`)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setCreating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {fields.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Henüz alan yok.</p>
              <Button className="mt-4" onClick={() => openCreateDialog(null)}>
                <Plus className="h-4 w-4 mr-2" />
                İlk Alanı Oluştur
              </Button>
            </CardContent>
          </Card>
        ) : (
          fields.map((field) => {
            const isExpanded = expanded.has(field.id)
            return (
              <div key={field.id} className="rounded-xl border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-card hover:bg-accent/30 transition-colors">
                  <button
                    type="button"
                    onClick={() => field.children.length > 0 && toggleExpand(field.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {field.children.length > 0 ? (
                      <>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <FolderOpen className="h-4 w-4 text-primary" />
                      </>
                    ) : (
                      <>
                        <span className="w-4" />
                        <FolderClosed className="h-4 w-4 text-muted-foreground" />
                      </>
                    )}
                    <span className="font-medium text-sm">{field.name}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({field.children.length} alt alan)
                    </span>
                  </button>

                  {field.drive_folder_id && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      Drive ✓
                    </span>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => openCreateDialog(field.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Alt Alan
                  </Button>
                  {isAdminUser && field.children.length === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Alanı sil"
                      disabled={deletingId === field.id}
                      onClick={() => handleDelete(field.id, field.name)}
                    >
                      {deletingId === field.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>

                {isExpanded && field.children.length > 0 && (
                  <div className="border-t bg-muted/30">
                    {field.children.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-2 px-4 py-2.5 pl-10 border-b last:border-0 hover:bg-accent/30 transition-colors"
                      >
                        <FolderClosed className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1">{child.name}</span>
                        {child.drive_folder_id && (
                          <span className="text-xs text-muted-foreground">Drive ✓</span>
                        )}
                        {isAdminUser && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            title="Alt alanı sil"
                            disabled={deletingId === child.id}
                            onClick={() => handleDelete(child.id, child.name)}
                          >
                            {deletingId === child.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Trash2 className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}

        <Button variant="outline" className="w-full gap-2" onClick={() => openCreateDialog(null)}>
          <Plus className="h-4 w-4" />
          Yeni Ana Alan Oluştur
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {newFieldParentId ? "Yeni Alt Alan" : "Yeni Ana Alan"}
            </DialogTitle>
          </DialogHeader>
          {newFieldParentId && (
            <p className="text-sm text-muted-foreground">
              Üst alan:{" "}
              <span className="font-medium text-foreground">
                {fields.find((f) => f.id === newFieldParentId)?.name}
              </span>
            </p>
          )}
          <Input
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="Alan adı..."
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Google Drive'da otomatik olarak bir klasör oluşturulacak.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newFieldName.trim()}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
