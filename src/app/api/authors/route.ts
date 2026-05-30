import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"

// GET /api/authors?q=<search>
// Returns up to 20 authors matching the query with their article count.
export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""

  let query = supabase
    .from("authors")
    .select("id, name")
    .order("name")
    .limit(20)

  if (q) query = query.ilike("name", `%${q}%`)

  const { data: authors, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!authors?.length) return NextResponse.json([])

  // Fetch article counts for the matched authors
  const ids = authors.map((a) => a.id)
  const { data: counts } = await supabase
    .from("article_authors")
    .select("author_id")
    .in("author_id", ids)

  const countMap: Record<string, number> = {}
  ;(counts ?? []).forEach((r) => {
    countMap[r.author_id] = (countMap[r.author_id] ?? 0) + 1
  })

  const result = authors.map((a) => ({
    ...a,
    article_count: countMap[a.id] ?? 0,
  }))

  return NextResponse.json(result)
}
