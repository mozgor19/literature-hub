import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { createUserScopedClient } from "@/lib/supabase-user"
import { deleteFileFromDrive } from "@/lib/drive"
import { isAdmin } from "@/lib/permissions"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from("articles")
    .select(
      `*, field:fields!field_id(*), article_tags(tag_id, tags(id, name)), added_by_user:users!added_by(id, name, email)`
    )
    .eq("id", id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  return NextResponse.json({
    ...data,
    tags: (data.article_tags ?? []).map((at: { tags: unknown }) => at.tags).filter(Boolean),
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // ── 1. Load article + its current tag IDs (needed for orphan cleanup) ───────
  const [articleResult, tagLinksResult] = await Promise.all([
    supabase.from("articles").select("id, drive_file_id, added_by, field_id").eq("id", id).single(),
    supabase.from("article_tags").select("tag_id").eq("article_id", id),
  ])

  const { data: article, error: articleError } = articleResult
  if (articleError || !article) {
    return NextResponse.json({ error: "Makale bulunamadı" }, { status: 404 })
  }
  const tagIds = (tagLinksResult.data ?? []).map((t) => t.tag_id)

  // ── 2. App-layer permission check (first line of defense) ──────────────────
  const requesterIsAdmin = isAdmin(session.user.email)
  if (!requesterIsAdmin && article.added_by !== session.user.id) {
    return NextResponse.json({ error: "Bu makaleyi silme yetkiniz yok" }, { status: 403 })
  }

  // ── 3. Delete PDF from Drive ───────────────────────────────────────────────
  // Service account preferred; falls back to the session's OAuth token.
  const fallbackToken = session.accessToken
  let driveDeleted = true
  if (article.drive_file_id) {
    try {
      await deleteFileFromDrive(article.drive_file_id, fallbackToken)
    } catch (err) {
      console.error("Drive file deletion failed:", err)
      driveDeleted = false
      if (!requesterIsAdmin) {
        return NextResponse.json(
          { error: "PDF Drive üzerinden silinemedi. Makale kaydı korunuyor." },
          { status: 500 }
        )
      }
      // Admin: log drive failure but proceed to remove the DB row.
    }
  }

  // ── 4. Delete article row (user-scoped client → RLS second-line defense) ───
  // CASCADE on article_tags and project_articles cleans up all references.
  const userDb = await createUserScopedClient(session.user.id)
  const { error: deleteError } = await userDb.from("articles").delete().eq("id", id)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // ── 5. Delete orphaned tags (tags no longer referenced by any article) ──────
  if (tagIds.length > 0) {
    const { data: stillUsed } = await supabase
      .from("article_tags")
      .select("tag_id")
      .in("tag_id", tagIds)

    const stillUsedSet = new Set((stillUsed ?? []).map((r) => r.tag_id))
    const orphaned = tagIds.filter((tid) => !stillUsedSet.has(tid))

    if (orphaned.length > 0) {
      await supabase.from("tags").delete().in("id", orphaned)
    }
  }

  // ── 6. Delete orphaned sub-field (no articles left + has a parent) ──────────
  if (article.field_id) {
    const { data: field } = await supabase
      .from("fields")
      .select("id, parent_id")
      .eq("id", article.field_id)
      .single()

    if (field?.parent_id) {
      const { count: remaining } = await supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("field_id", field.id)

      if ((remaining ?? 0) === 0) {
        await supabase.from("fields").delete().eq("id", field.id)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    driveDeleted,
    warning:
      requesterIsAdmin && !driveDeleted
        ? "Makale kaydı silindi, ancak Drive dosyası silinemedi."
        : undefined,
  })
}
