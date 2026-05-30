import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { diceSimilarity, normalizeDoi, TITLE_SIM_THRESHOLD } from "@/lib/similarity"

export interface DuplicateMatch {
  id: string
  title: string
  authors: string
  year: number | null
  drive_web_link: string
  match_type: "doi" | "title"
  similarity: number
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const inputTitle = searchParams.get("title")?.trim() ?? ""
  const inputUrl = searchParams.get("source_url")?.trim() ?? ""

  if (!inputTitle && !inputUrl) {
    return NextResponse.json({ matches: [] })
  }

  // Fetch only the lightweight columns needed for comparison
  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, title, authors, year, source_url, drive_web_link")
    .order("added_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inputDoi = normalizeDoi(inputUrl)
  const matches: DuplicateMatch[] = []

  for (const article of articles ?? []) {
    // ── Strong match: same DOI after normalization ──────────────────────────
    if (inputDoi) {
      const articleDoi = normalizeDoi(article.source_url)
      if (articleDoi && articleDoi === inputDoi) {
        matches.push({
          id: article.id,
          title: article.title,
          authors: article.authors,
          year: article.year,
          drive_web_link: article.drive_web_link,
          match_type: "doi",
          similarity: 1,
        })
        continue
      }
    }

    // ── Soft match: high title similarity ───────────────────────────────────
    if (inputTitle) {
      const sim = diceSimilarity(inputTitle, article.title)
      if (sim >= TITLE_SIM_THRESHOLD) {
        matches.push({
          id: article.id,
          title: article.title,
          authors: article.authors,
          year: article.year,
          drive_web_link: article.drive_web_link,
          match_type: "title",
          similarity: sim,
        })
      }
    }
  }

  // Sort: DOI matches first, then by descending similarity
  matches.sort((a, b) => {
    if (a.match_type === "doi" && b.match_type !== "doi") return -1
    if (b.match_type === "doi" && a.match_type !== "doi") return 1
    return b.similarity - a.similarity
  })

  return NextResponse.json({ matches })
}
