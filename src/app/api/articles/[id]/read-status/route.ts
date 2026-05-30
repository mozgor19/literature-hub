import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import type { ReadStatus } from "@/types/database"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: articleId } = await params

  // App-layer scope: always filter to the requesting user's own row.
  const { data } = await supabase
    .from("article_read_status")
    .select("status")
    .eq("user_id", session.user.id)
    .eq("article_id", articleId)
    .single()

  const status: ReadStatus = (data?.status as ReadStatus) ?? "unread"
  return NextResponse.json({ status })
}

export async function PUT(req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: articleId } = await params

  let body: { status?: string } = {}
  try {
    body = await req.json() as { status?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { status } = body
  if (!status || !["unread", "reading", "read"].includes(status)) {
    return NextResponse.json({ error: "status must be unread, reading, or read" }, { status: 400 })
  }

  if (status === "unread") {
    // Absent row = unread — delete the row if it exists.
    // App-layer scope: always restrict to own row (eq user_id).
    await supabase
      .from("article_read_status")
      .delete()
      .eq("user_id", session.user.id)
      .eq("article_id", articleId)
    return NextResponse.json({ status: "unread" })
  }

  // Upsert 'reading' or 'read' row.
  const { error } = await supabase
    .from("article_read_status")
    .upsert(
      { user_id: session.user.id, article_id: articleId, status, updated_at: new Date().toISOString() },
      { onConflict: "user_id,article_id" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status })
}
