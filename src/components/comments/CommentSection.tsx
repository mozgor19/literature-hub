"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  MessageSquare, Loader2, Reply, Pencil, Trash2,
  ChevronDown, ChevronUp, ImagePlus, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"
import type { CommentWithUser } from "@/types/database"

// ── XSS-safe body renderer ────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;")
}

function renderText(chunk: string): string {
  const URL_RE = /https?:\/\/[^\s<>"']+/g
  const parts: string[] = []
  let last = 0
  for (const m of chunk.matchAll(URL_RE)) {
    parts.push(escHtml(chunk.slice(last, m.index)))
    const url = escHtml(m[0])
    parts.push(
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:opacity-80">${url}</a>`
    )
    last = m.index! + m[0].length
  }
  parts.push(escHtml(chunk.slice(last)))
  return parts.join("")
    .replace(/\*\*([^*<\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>")
}

// Handles text + ![](url) image markdown
function renderBody(raw: string): string {
  const IMG_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)>"]+)\)/g
  const result: string[] = []
  let pos = 0
  for (const m of raw.matchAll(IMG_RE)) {
    if (m.index! > pos) result.push(renderText(raw.slice(pos, m.index)))
    const url = escHtml(m[2])
    const alt = escHtml(m[1] || "görsel")
    result.push(
      `<img src="${url}" alt="${alt}" data-lightbox="${url}" ` +
      `class="mt-2 max-w-full rounded-lg cursor-zoom-in block" style="max-height:360px;object-fit:contain" />`
    )
    pos = m.index! + m[0].length
  }
  if (pos < raw.length) result.push(renderText(raw.slice(pos)))
  return result.join("")
}

// ── Thread builder ────────────────────────────────────────────────────────────

function buildTree(flat: CommentWithUser[], parentId: string | null = null): CommentWithUser[] {
  return flat
    .filter((c) => c.parent_id === parentId)
    .map((c) => ({ ...c, replies: buildTree(flat, c.id) }))
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-w-full max-h-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </button>
    </div>
  )
}

// ── Image preview strip ───────────────────────────────────────────────────────

type PendingImage = { file: File; preview: string }

function ImagePreviews({
  images,
  onRemove,
}: {
  images: PendingImage[]
  onRemove: (i: number) => void
}) {
  if (images.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {images.map((img, i) => (
        <div key={i} className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.preview}
            alt=""
            className="h-20 w-20 rounded-md object-cover border border-border"
          />
          <button
            type="button"
            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(i)}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Comment input ─────────────────────────────────────────────────────────────

function CommentInput({
  placeholder,
  onSubmit,
  onCancel,
  initialValue = "",
  submitLabel = "Gönder",
}: {
  placeholder: string
  onSubmit: (body: string) => Promise<void>
  onCancel?: () => void
  initialValue?: string
  submitLabel?: string
}) {
  const [body, setBody] = useState(initialValue)
  const [images, setImages] = useState<PendingImage[]>([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addImages = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      setImages((prev) => [...prev, { file, preview: URL.createObjectURL(file) }])
    })
  }

  const removeImage = (i: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].preview)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  const handleSubmit = async () => {
    const trimmed = body.trim()
    if (!trimmed && images.length === 0) return
    setSaving(true)
    try {
      let finalBody = trimmed
      if (images.length > 0) {
        const urls: string[] = []
        for (const img of images) {
          const fd = new FormData()
          fd.append("image", img.file)
          const res = await fetch("/api/comments/upload-image", { method: "POST", body: fd })
          if (res.ok) {
            const { url } = await res.json() as { url: string }
            urls.push(`![](${url})`)
          } else {
            const d = await res.json() as { error?: string }
            toast.error(d.error ?? "Görsel yüklenemedi")
          }
        }
        finalBody = [finalBody, ...urls].filter(Boolean).join("\n")
      }
      if (!finalBody.trim()) return
      await onSubmit(finalBody)
      setBody("")
      setImages((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.preview)); return [] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={4000}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit()
        }}
        className="resize-none text-sm"
      />
      <ImagePreviews images={images} onRemove={removeImage} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Ctrl+Enter · **kalın** · görsel ekle
        </p>
        <div className="flex gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addImages(e.target.files)}
            onClick={(e) => { (e.target as HTMLInputElement).value = "" }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Görsel ekle"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
              İptal
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving || (!body.trim() && images.length === 0)}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Single comment ────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  articleId,
  currentUserId,
  isCurrentUserAdmin,
  depth = 0,
  onMutate,
  onLightbox,
}: {
  comment: CommentWithUser
  articleId: string
  currentUserId: string | null
  isCurrentUserAdmin: boolean
  depth?: number
  onMutate: () => void
  onLightbox: (src: string) => void
}) {
  const [showReply, setShowReply] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canEdit = !comment.is_deleted && comment.user_id === currentUserId
  const canDelete = !comment.is_deleted && (isCurrentUserAdmin || comment.user_id === currentUserId)

  const indent = Math.min(depth, 3) * 16 // px, capped at 3 levels (tighter on mobile)

  const handleEdit = async (newBody: string) => {
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newBody }),
    })
    if (!res.ok) { toast.error((await res.json() as { error?: string }).error ?? "Düzenlenemedi"); return }
    toast.success("Yorum güncellendi")
    setEditing(false)
    onMutate()
  }

  const handleDelete = async () => {
    if (!confirm("Bu yorumu silmek istediğinize emin misiniz?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" })
      if (!res.ok) { toast.error((await res.json() as { error?: string }).error ?? "Silinemedi"); return }
      toast.success("Yorum silindi")
      onMutate()
    } finally { setDeleting(false) }
  }

  const handleReply = async (body: string) => {
    const res = await fetch(`/api/articles/${articleId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, parent_id: comment.id }),
    })
    if (!res.ok) { toast.error((await res.json() as { error?: string }).error ?? "Yanıt gönderilemedi"); return }
    setShowReply(false)
    onMutate()
  }

  const user = comment.user as { name: string | null; email: string; image?: string | null }

  return (
    <div
      id={`comment-${comment.id}`}
      style={{ paddingLeft: `${indent}px` }}
      className={depth > 0 ? "border-l-2 border-border/40 pl-4" : ""}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-6 w-6 rounded-full shrink-0" />
        ) : (
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
            {(user.name ?? user.email)?.[0]?.toUpperCase()}
          </div>
        )}
        <span className="text-sm font-medium">{user.name ?? user.email}</span>
        <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
        {comment.is_edited && <span className="text-xs text-muted-foreground italic">(düzenlendi)</span>}
      </div>

      {/* Body */}
      <div className="mt-1 ml-6 sm:ml-8">
        {comment.is_deleted ? (
          <p className="text-sm text-muted-foreground italic">[silindi]</p>
        ) : editing ? (
          <CommentInput
            placeholder="Yorumu düzenle…"
            initialValue={comment.body ?? ""}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            submitLabel="Kaydet"
          />
        ) : (
          <div
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderBody(comment.body ?? "") }}
            onClick={(e) => {
              const img = (e.target as HTMLElement).closest<HTMLImageElement>("img[data-lightbox]")
              if (img) onLightbox(img.dataset.lightbox!)
            }}
          />
        )}

        {/* Actions */}
        {!comment.is_deleted && !editing && (
          <div className="flex items-center gap-1 mt-1 -ml-1">
            {currentUserId && (
              <Button
                variant="ghost" size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => setShowReply((v) => !v)}
              >
                <Reply className="h-3 w-3" />
                Yanıtla
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost" size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3" />
                Düzenle
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost" size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Sil
              </Button>
            )}
          </div>
        )}

        {/* Inline reply form */}
        {showReply && (
          <div className="mt-2">
            <CommentInput
              placeholder="Yanıtınızı yazın…"
              onSubmit={handleReply}
              onCancel={() => setShowReply(false)}
              submitLabel="Yanıtla"
            />
          </div>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-4">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                articleId={articleId}
                currentUserId={currentUserId}
                isCurrentUserAdmin={isCurrentUserAdmin}
                depth={depth + 1}
                onMutate={onMutate}
                onLightbox={onLightbox}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

export function CommentSection({
  articleId,
  currentUserId,
  isCurrentUserAdmin,
}: {
  articleId: string
  currentUserId: string | null
  isCurrentUserAdmin: boolean
}) {
  const queryClient = useQueryClient()
  const [sortAsc, setSortAsc] = useState(true)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const hasScrolled = useRef(false)

  const { data: rawComments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: ["comments", articleId],
    queryFn: () => fetch(`/api/articles/${articleId}/comments`).then((r) => r.json()),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  })

  // Scroll to a specific comment on load (e.g. from notification link)
  useEffect(() => {
    if (hasScrolled.current || rawComments.length === 0) return
    const hash = window.location.hash
    if (!hash.startsWith("#comment-")) return
    const el = document.getElementById(hash.slice(1))
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("ring-2", "ring-primary/40", "rounded-md")
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/40", "rounded-md"), 2500)
      hasScrolled.current = true
    }
  }, [rawComments])

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["comments", articleId] })

  const threaded = buildTree(rawComments)
  const sorted = sortAsc ? threaded : [...threaded].reverse()

  const handlePostTopLevel = async (body: string) => {
    const res = await fetch(`/api/articles/${articleId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    })
    if (!res.ok) { toast.error((await res.json() as { error?: string }).error ?? "Yorum gönderilemedi"); return }
    toast.success("Yorum gönderildi")
    refetch()
  }

  const visibleCount = rawComments.filter((c) => !c.is_deleted).length

  return (
    <section className="space-y-6">
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Tartışma
          {visibleCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({visibleCount})</span>
          )}
        </h2>
        {threaded.length > 1 && (
          <Button
            variant="ghost" size="sm"
            className="text-xs gap-1 text-muted-foreground"
            onClick={() => setSortAsc((v) => !v)}
          >
            {sortAsc ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {sortAsc ? "Eskiden Yeniye" : "Yeniden Eskiye"}
          </Button>
        )}
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz yorum yok. İlk yorumu siz yazın.</p>
      ) : (
        <div className="space-y-6">
          {sorted.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                articleId={articleId}
                currentUserId={currentUserId}
                isCurrentUserAdmin={isCurrentUserAdmin}
                onMutate={refetch}
                onLightbox={setLightboxSrc}
              />
              <Separator className="mt-4" />
            </div>
          ))}
        </div>
      )}

      {/* New comment box */}
      {currentUserId ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Yorum Ekle</h3>
          <CommentInput
            placeholder="Yorumunuzu yazın…"
            onSubmit={handlePostTopLevel}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Yorum yazmak için giriş yapmanız gerekiyor.
        </p>
      )}
    </section>
  )
}
