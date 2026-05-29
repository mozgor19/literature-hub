import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: project_id } = await params
  const { article_id } = await request.json()

  if (!article_id) {
    return NextResponse.json({ error: "article_id zorunludur" }, { status: 400 })
  }

  const { error } = await supabase.from("project_articles").upsert(
    { project_id, article_id, added_by: session.user.id },
    { onConflict: "project_id,article_id" }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: project_id } = await params
  const { searchParams } = new URL(request.url)
  const article_id = searchParams.get("article_id")

  if (!article_id) {
    return NextResponse.json({ error: "article_id zorunludur" }, { status: 400 })
  }

  const { error } = await supabase
    .from("project_articles")
    .delete()
    .eq("project_id", project_id)
    .eq("article_id", article_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
