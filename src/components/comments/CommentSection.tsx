"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { MessageSquare, Loader2, Reply, Pencil, Trash2, Check, X, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"
import type { CommentWithUser } from "@/types/database"

// ─── XSS-safe renderer: HTML-escape → linkify → bold → newlines ──────────────

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;")
}

function renderBody(raw: string): string {
  const URL_RE = /https?:\/\/[^\s<>"']+/g
  const parts: string[] = []
  let last = 0
  for (const m of raw.matchAll(URL_RE)) {
    parts.push(escHtml(raw.slice(last, m.index)))
    const url = escHtml(m[0])
    parts.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:opacity-80">${url}</a>`)
    last = m.index! + m[0].length
  }
  parts.push(escHtml(raw.slice(last)))
  return parts.join("")
    .replace(/\*\*([^*<\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>")
}

// ─── Comment input box ────────────────────────────────────────────────────────

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
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    const trimmed = body.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await onSubmit(trimmed)
      setBody("")
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
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Ctrl+Enter ile gönder · **kalın** · `https://...` tıklanabilir
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
              İptal
            </Button>
          )}
          <Button size="sm" onClick={handleSubmit} disabled={saving || !body.trim()}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Single comment (handles its own edit/reply inline state) ─────────────────

function CommentItem({
  comment,
  articleId,
  currentUserId,
  isCurrentUserAdmin,
  isReply = false,
  onMutate,
}: {
  comment: CommentWithUser
  articleId: string
  currentUserId: string | null
  isCurrentUserAdmin: boolean
  isReply?: boolean
  onMutate: () => void
}) {
  const [showReply, setShowReply] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canEdit = !comment.is_deleted && comment.user_id === currentUserId
  const canDelete =
    !comment.is_deleted &&
    (isCurrentUserAdmin || comment.user_id === currentUserId)

  const handleEdit = async (newBody: string) => {
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newBody }),
    })
    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? "Düzenlenemedi")
      return
    }
    toast.success("Yorum güncellendi")
    setEditing(false)
    onMutate()
  }

  const handleDelete = async () => {
    if (!confirm("Bu yorumu silmek istediğinize emin misiniz?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? "Silinemedi")
        return
      }
      toast.success("Yorum silindi")
      onMutate()
    } finally {
      setDeleting(false)
    }
  }

  const handleReply = async (body: string) => {
    const res = await fetch(`/api/articles/${articleId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, parent_id: comment.id }),
    })
    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? "Yanıt gönderilemedi")
      return
    }
    setShowReply(false)
    onMutate()
  }

  const user = comment.user as { name: string | null; email: string; image?: string | null }

  return (
    <div className={`space-y-2 ${isReply ? "pl-8 border-l border-border" : ""}`}>
      {/* Header row */}
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
        {comment.is_edited && (
          <span className="text-xs text-muted-foreground italic">(düzenlendi)</span>
        )}
      </div>

      {/* Body */}
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
        <p
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderBody(comment.body ?? "") }}
        />
      )}

      {/* Action bar */}
      {!comment.is_deleted && !editing && (
        <div className="flex items-center gap-1 -ml-1">
          {!isReply && currentUserId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => setShowReply((v) => !v)}
            >
              <Reply className="h-3 w-3" />
              Yanıtla
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
              Düzenle
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
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
        <div className="pl-8 pt-1">
          <CommentInput
            placeholder="Yanıtınızı yazın…"
            onSubmit={handleReply}
            onCancel={() => setShowReply(false)}
            submitLabel="Yanıtla"
          />
        </div>
      )}

      {/* Nested replies */}
      {!isReply && comment.replies && comment.replies.length > 0 && (
        <div className="space-y-4 pt-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              articleId={articleId}
              currentUserId={currentUserId}
              isCurrentUserAdmin={isCurrentUserAdmin}
              isReply
              onMutate={onMutate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

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
  const [sortAsc, setSortAsc] = useState(true) // oldest first

  const { data: rawComments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: ["comments", articleId],
    queryFn: () => fetch(`/api/articles/${articleId}/comments`).then((r) => r.json()),
    refetchOnWindowFocus: false,
  })

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["comments", articleId] })

  // Build thread: top-level comments + their replies
  const topLevel = rawComments.filter((c) => !c.parent_id)
  const replies = rawComments.filter((c) => !!c.parent_id)
  const threaded: CommentWithUser[] = topLevel.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parent_id === c.id),
  }))
  const sorted = sortAsc ? threaded : [...threaded].reverse()

  const handlePostTopLevel = async (body: string) => {
    const res = await fetch(`/api/articles/${articleId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    })
    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? "Yorum gönderilemedi")
      return
    }
    toast.success("Yorum gönderildi")
    refetch()
  }

  const visibleCount = rawComments.filter((c) => !c.is_deleted).length

  return (
    <section className="space-y-6">
      {/* Section header */}
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
            variant="ghost"
            size="sm"
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
        <p className="text-sm text-muted-foreground">
          Henüz yorum yok. İlk yorumu siz yazın.
        </p>
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
