import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: article_id } = await params

  const { data, error } = await supabase
    .from("comments")
    .select(`id, article_id, user_id, parent_id, body, created_at, updated_at, is_edited, is_deleted,
      user:users!user_id(id, name, email, image)`)
    .eq("article_id", article_id)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hide body of soft-deleted comments
  const comments = (data ?? []).map((c) => ({
    ...c,
    body: c.is_deleted ? null : c.body,
  }))

  return NextResponse.json(comments)
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: article_id } = await params
  const { body, parent_id } = await req.json() as { body?: string; parent_id?: string | null }

  const trimmed = body?.trim()
  if (!trimmed) return NextResponse.json({ error: "Yorum boş olamaz" }, { status: 400 })
  if (trimmed.length > 4000) return NextResponse.json({ error: "Yorum çok uzun (maks 4000 karakter)" }, { status: 400 })

  // If replying, verify the parent belongs to the same article and is top-level
  if (parent_id) {
    const { data: parent } = await supabase
      .from("comments")
      .select("id, article_id, parent_id")
      .eq("id", parent_id)
      .single()
    if (!parent || parent.article_id !== article_id) {
      return NextResponse.json({ error: "Geçersiz üst yorum" }, { status: 400 })
    }
    // Flatten: replies to replies become replies to the top-level comment
    if (parent.parent_id) {
      return NextResponse.json({ error: "Yalnızca bir seviye iç içe yanıt destekleniyor" }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({ article_id, user_id: session.user.id, parent_id: parent_id ?? null, body: trimmed })
    .select(`id, article_id, user_id, parent_id, body, created_at, updated_at, is_edited, is_deleted,
      user:users!user_id(id, name, email, image)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
