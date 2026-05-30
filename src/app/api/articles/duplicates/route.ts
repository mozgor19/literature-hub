import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isAdmin } from "@/lib/permissions"
import { supabase } from "@/lib/supabase"
import { diceSimilarity, normalizeDoi, TITLE_SIM_THRESHOLD } from "@/lib/similarity"

export interface DuplicateArticle {
  id: string
  title: string
  authors: string
  year: number | null
  drive_web_link: string
  source_url: string | null
}

export interface DuplicateGroup {
  match_type: "doi" | "title"
  similarity: number
  articles: DuplicateArticle[]
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, title, authors, year, source_url, drive_web_link")
    .order("added_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const all = articles ?? []

  // Union-Find for grouping connected duplicate pairs
  const parent: Record<string, string> = {}
  const find = (x: string): string => {
    if (parent[x] === undefined) parent[x] = x
    if (parent[x] !== x) parent[x] = find(parent[x])
    return parent[x]
  }
  const union = (a: string, b: string) => {
    parent[find(a)] = find(b)
  }

  // Track the best match_type and similarity for each original article pair.
  const pairMeta: Record<string, { match_type: "doi" | "title"; similarity: number }> = {}

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]
      const b = all[j]

      // DOI match
      const doiA = normalizeDoi(a.source_url)
      const doiB = normalizeDoi(b.source_url)
      if (doiA && doiB && doiA === doiB) {
        union(a.id, b.id)
        const key = [a.id, b.id].sort().join(":")
        pairMeta[key] = { match_type: "doi", similarity: 1 }
        continue
      }

      // Title similarity
      const sim = diceSimilarity(a.title, b.title)
      if (sim >= TITLE_SIM_THRESHOLD) {
        union(a.id, b.id)
        const key = [a.id, b.id].sort().join(":")
        if (!pairMeta[key] || sim > pairMeta[key].similarity) {
          pairMeta[key] = { match_type: "title", similarity: sim }
        }
      }
    }
  }

  // Build groups
  const groupMap: Record<string, DuplicateArticle[]> = {}
  for (const article of all) {
    const root = find(article.id)
    if (!groupMap[root]) groupMap[root] = []
    groupMap[root].push({
      id: article.id,
      title: article.title,
      authors: article.authors,
      year: article.year,
      drive_web_link: article.drive_web_link,
      source_url: article.source_url,
    })
  }

  const groups: DuplicateGroup[] = Object.entries(groupMap)
    .filter(([, arts]) => arts.length >= 2)
    .map(([, arts]) => {
      // Find best meta from pairs that belong to this group.
      const articleIds = new Set(arts.map((article) => article.id))
      let bestMeta: { match_type: "doi" | "title"; similarity: number } = {
        match_type: "title",
        similarity: 0,
      }
      for (const [pairKey, meta] of Object.entries(pairMeta)) {
        const [aId, bId] = pairKey.split(":")
        if (!articleIds.has(aId) || !articleIds.has(bId)) continue
        if (meta.match_type === "doi") { bestMeta = meta; break }
        if (meta.similarity > bestMeta.similarity) bestMeta = meta
      }
      return { ...bestMeta, articles: arts }
    })
    .sort((a, b) => {
      if (a.match_type === "doi" && b.match_type !== "doi") return -1
      if (b.match_type === "doi" && a.match_type !== "doi") return 1
      return b.similarity - a.similarity
    })

  return NextResponse.json({ groups })
}
