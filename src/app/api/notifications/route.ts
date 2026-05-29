import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"

// ── GET /api/notifications  —  fetch current user's notifications ─────────────
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("notifications")
    .select(`
      id, type, is_read, created_at,
      article:articles!article_id(id, title),
      actor:users!actor_id(id, name, email, image)
    `)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ── PATCH /api/notifications  —  mark all as read ────────────────────────────
export async function PATCH() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", session.user.id)
    .eq("is_read", false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
