import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { deleteFileFromDrive } from "@/lib/drive"

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
  if (!session.accessToken) {
    return NextResponse.json({ error: "Drive erişim tokeni bulunamadı" }, { status: 401 })
  }

  const { id } = await params

  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("id, drive_file_id")
    .eq("id", id)
    .single()

  if (articleError || !article) {
    return NextResponse.json({ error: "Makale bulunamadı" }, { status: 404 })
  }

  try {
    await deleteFileFromDrive(session.accessToken, article.drive_file_id)
  } catch (error) {
    console.error("Drive file deletion failed:", error)
    return NextResponse.json(
      { error: "PDF Drive üzerinden silinemedi. Makale kaydı korunuyor." },
      { status: 500 }
    )
  }

  const { error } = await supabase.from("articles").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
