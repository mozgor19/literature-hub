"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  FolderOpen, FolderClosed, Plus, Loader2,
  ChevronDown, ChevronRight, Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { FieldWithChildren } from "@/types/database"

// ── Recursive field node ──────────────────────────────────────────────────────

function FieldNode({
  field,
  depth,
  currentUserId,
  isAdminUser,
  expanded,
  toggleExpand,
  onCreateChild,
  onDelete,
  deletingId,
}: {
  field: FieldWithChildren
  depth: number
  currentUserId: string | undefined
  isAdminUser: boolean
  expanded: Set<string>
  toggleExpand: (id: string) => void
  onCreateChild: (parentId: string) => void
  onDelete: (id: string, name: string) => void
  deletingId: string | null
}) {
  const isExpanded = expanded.has(field.id)
  const hasChildren = field.children.length > 0
  const canDelete = isAdminUser || field.created_by === currentUserId

  return (
    <div>
      {/* Row */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 hover:bg-accent/30 transition-colors"
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        <button
          type="button"
          className="flex items-center gap-2 flex-1 text-left min-w-0"
          onClick={() => hasChildren && toggleExpand(field.id)}
        >
          {hasChildren ? (
            isExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <span className="w-4 shrink-0" />
          )}
          {hasChildren
            ? <FolderOpen className="h-4 w-4 text-primary shrink-0" />
            : <FolderClosed className="h-4 w-4 text-muted-foreground shrink-0" />}
          <span className={`text-sm truncate ${depth === 0 ? "font-medium" : ""}`}>
            {field.name}
          </span>
          {field.children.length > 0 && (
            <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
              ({field.children.length})
            </span>
          )}
        </button>

        {field.drive_folder_id && (
          <span className="text-xs text-muted-foreground hidden lg:inline shrink-0">Drive ✓</span>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs h-7 shrink-0"
          onClick={() => onCreateChild(field.id)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Alt Alan</span>
        </Button>

        {canDelete && field.children.length === 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
            title="Alanı sil"
            disabled={deletingId === field.id}
            onClick={() => onDelete(field.id, field.name)}
          >
            {deletingId === field.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>

      {/* Recursive children */}
      {isExpanded && hasChildren && (
        <div className="border-l border-border/40 ml-6">
          {field.children.map((child) => (
            <FieldNode
              key={child.id}
              field={child}
              depth={depth + 1}
              currentUserId={currentUserId}
              isAdminUser={isAdminUser}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function FieldTree() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAdminUser = session?.user?.isAdmin ?? false
  const currentUserId = session?.user?.id

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

  // Helper: find a field by ID anywhere in the tree
  function findField(nodes: FieldWithChildren[], id: string): FieldWithChildren | undefined {
    for (const n of nodes) {
      if (n.id === id) return n
      const found = findField(n.children, id)
      if (found) return found
    }
    return undefined
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
      const data = await res.json() as { error?: string; name?: string }
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

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  // Parent field name for dialog
  const parentLabel = newFieldParentId
    ? (findField(fields, newFieldParentId)?.name ?? "")
    : null

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
          <div className="rounded-xl border overflow-hidden divide-y">
            {fields.map((field) => (
              <FieldNode
                key={field.id}
                field={field}
                depth={0}
                currentUserId={currentUserId}
                isAdminUser={isAdminUser}
                expanded={expanded}
                toggleExpand={toggleExpand}
                onCreateChild={openCreateDialog}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            ))}
          </div>
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
          {parentLabel && (
            <p className="text-sm text-muted-foreground">
              Üst alan: <span className="font-medium text-foreground">{parentLabel}</span>
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button>
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
