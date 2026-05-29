import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { createUserScopedClient } from "@/lib/supabase-user"
import { deleteFileFromDrive } from "@/lib/drive"
import { getDriveAuthForRequest } from "@/lib/google-auth"
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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const driveAuth = await getDriveAuthForRequest(request, session.accessToken)
  if (!driveAuth) {
    return NextResponse.json({ error: "Drive erişim tokeni bulunamadı" }, { status: 401 })
  }

  const { id } = await params

  // ── 1. Load article (service role – no RLS gate here) ──────────────────────
  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("id, drive_file_id, added_by")
    .eq("id", id)
    .single()

  if (articleError || !article) {
    return NextResponse.json({ error: "Makale bulunamadı" }, { status: 404 })
  }

  // ── 2. App-layer permission check (first line of defense) ──────────────────
  const requesterIsAdmin = isAdmin(session.user.email)
  const isOwner = article.added_by === session.user.id
  if (!requesterIsAdmin && !isOwner) {
    return NextResponse.json(
      { error: "Bu makaleyi silme yetkiniz yok" },
      { status: 403 }
    )
  }

  // ── 3. Delete PDF from Drive ───────────────────────────────────────────────
  let driveDeleted = true
  if (article.drive_file_id) {
    try {
      await deleteFileFromDrive(driveAuth, article.drive_file_id)
    } catch (err) {
      console.error("Drive file deletion failed:", err)
      driveDeleted = false
      // Non-admins: abort; the article row is untouched so the Drive file can
      // still be found manually.
      if (!requesterIsAdmin) {
        return NextResponse.json(
          { error: "PDF Drive üzerinden silinemedi. Makale kaydı korunuyor." },
          { status: 500 }
        )
      }
      // Admins: log the drive failure but proceed to remove the DB row.
    }
  }

  // ── 4. Delete article row via user-scoped client (second line of defense) ──
  // When SUPABASE_JWT_SECRET is set this uses an RLS-authenticated client so
  // the "articles_delete_owner_or_admin" policy also applies.
  const userDb = await createUserScopedClient(session.user.id)
  const { error: deleteError } = await userDb.from("articles").delete().eq("id", id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
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
