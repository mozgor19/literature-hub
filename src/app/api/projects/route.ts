import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("projects")
    .select(`*, created_by_user:users!created_by(id, name, email), project_articles(count)`)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const projects = (data ?? []).map((p) => ({
    ...p,
    article_count: (p.project_articles as Array<{ count: number }>)?.[0]?.count ?? 0,
  }))

  return NextResponse.json(projects)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, description } = await request.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: "Proje adı zorunludur" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ name: name.trim(), description: description?.trim() || null, created_by: session.user.id })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
