import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select(`*, created_by_user:users!created_by(id, name, email)`)
    .eq("id", id)
    .single()

  if (projErr) return NextResponse.json({ error: projErr.message }, { status: 404 })

  // Fetch articles in this project with full relations
  const { data: paData } = await supabase
    .from("project_articles")
    .select(
      `added_at, added_by,
      article:articles!article_id(
        id, title, authors, year, drive_web_link, drive_folder_path, field_id, added_at,
        field:fields!field_id(id, name, parent_id),
        article_tags(tags(id, name))
      )`
    )
    .eq("project_id", id)
    .order("added_at", { ascending: false })

  const articles = (paData ?? []).map((row) => {
    const a = row.article as Record<string, unknown>
    return {
      ...a,
      tags: ((a.article_tags as Array<{ tags: unknown }>) ?? [])
        .map((at) => at.tags)
        .filter(Boolean),
      added_to_project_at: row.added_at,
    }
  })

  return NextResponse.json({ ...project, articles })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { error } = await supabase.from("projects").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
