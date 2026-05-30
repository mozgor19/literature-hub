import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { deleteFileFromDrive } from "@/lib/drive"
import { isAdmin } from "@/lib/permissions"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const { data: field } = await supabase
    .from("fields")
    .select("id, name, drive_folder_id, parent_id, created_by")
    .eq("id", id)
    .single()

  if (!field) return NextResponse.json({ error: "Alan bulunamadı" }, { status: 404 })

  // Permission: creator OR admin (guard applies equally — no admin override on non-empty fields)
  const canDelete = isAdmin(session.user.email) || field.created_by === session.user.id
  if (!canDelete) {
    return NextResponse.json({ error: "Bu alanı yalnızca oluşturan kişi veya admin silebilir" }, { status: 403 })
  }

  // Block deletion if this field still has articles
  const { count: articleCount } = await supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("field_id", id)

  if ((articleCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Bu alanda makale var, önce makaleleri silin" },
      { status: 400 }
    )
  }

  // Block deletion if this field has sub-fields
  const { count: childCount } = await supabase
    .from("fields")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id)

  if ((childCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Bu alanın alt alanları var, önce alt alanları silin" },
      { status: 400 }
    )
  }

  // Delete Drive folder (best-effort; don't block DB cleanup on failure)
  let driveDeleted = false
  if (field.drive_folder_id) {
    try {
      await deleteFileFromDrive(field.drive_folder_id, session.accessToken)
      driveDeleted = true
    } catch (err) {
      console.error("Drive folder deletion failed:", err)
    }
  }

  const { error: deleteError } = await supabase.from("fields").delete().eq("id", id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  revalidateTag("fields", "max")

  return NextResponse.json({
    ok: true,
    driveDeleted,
    warning: field.drive_folder_id && !driveDeleted
      ? "Alan kaydı silindi, ancak Drive klasörü silinemedi"
      : undefined,
  })
}
