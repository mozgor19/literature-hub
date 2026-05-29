import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { isAdmin } from "@/lib/permissions"

type Params = { params: Promise<{ id: string }> }

// ── PUT /api/comments/[id]  —  edit own comment ───────────────────────────────
export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { body } = await req.json() as { body?: string }

  const trimmed = body?.trim()
  if (!trimmed) return NextResponse.json({ error: "Yorum boş olamaz" }, { status: 400 })
  if (trimmed.length > 4000) return NextResponse.json({ error: "Yorum çok uzun" }, { status: 400 })

  const { data: comment } = await supabase
    .from("comments")
    .select("id, user_id, is_deleted")
    .eq("id", id)
    .single()

  if (!comment) return NextResponse.json({ error: "Yorum bulunamadı" }, { status: 404 })
  if (comment.is_deleted) return NextResponse.json({ error: "Silinmiş yorum düzenlenemez" }, { status: 400 })
  if (comment.user_id !== session.user.id) {
    return NextResponse.json({ error: "Bu yorumu düzenleme yetkiniz yok" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("comments")
    .update({ body: trimmed, is_edited: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`id, article_id, user_id, parent_id, body, created_at, updated_at, is_edited, is_deleted,
      user:users!user_id(id, name, email, image)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── DELETE /api/comments/[id]  —  soft or hard delete ────────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const { data: comment } = await supabase
    .from("comments")
    .select("id, user_id, is_deleted")
    .eq("id", id)
    .single()

  if (!comment) return NextResponse.json({ error: "Yorum bulunamadı" }, { status: 404 })

  const canDelete = isAdmin(session.user.email) || comment.user_id === session.user.id
  if (!canDelete) return NextResponse.json({ error: "Bu yorumu silme yetkiniz yok" }, { status: 403 })

  // Check whether the comment has any non-deleted replies
  const { count: replyCount } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id)
    .eq("is_deleted", false)

  if ((replyCount ?? 0) > 0) {
    // Soft-delete: preserve thread structure, body hidden by API
    const { error } = await supabase
      .from("comments")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, softDeleted: true })
  }

  // Hard-delete: no living replies
  const { error } = await supabase.from("comments").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, softDeleted: false })
}
