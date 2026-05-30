import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"

// GET /api/organizations?q=<search>
export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""

  let query = supabase
    .from("organizations")
    .select("id, name")
    .order("name")
    .limit(20)

  if (q) query = query.ilike("name", `%${q}%`)

  const { data: orgs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!orgs?.length) return NextResponse.json([])

  const ids = orgs.map((o) => o.id)
  const { data: counts } = await supabase
    .from("article_organizations")
    .select("org_id")
    .in("org_id", ids)

  const countMap: Record<string, number> = {}
  ;(counts ?? []).forEach((r) => {
    countMap[r.org_id] = (countMap[r.org_id] ?? 0) + 1
  })

  return NextResponse.json(orgs.map((o) => ({ ...o, article_count: countMap[o.id] ?? 0 })))
}
