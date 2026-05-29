import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { bestLookup } from "@/lib/metadata-lookup"

/**
 * GET /api/articles/lookup
 *
 * Query params (at least one required):
 *   doi=10.xxxx/...
 *   arxiv=2301.12345
 *   title=Some+paper+title   (used only when no DOI/arXiv ID)
 *
 * Caches results per process (24 h TTL).
 * Returns null-safe: on failure returns 204 No Content.
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const doi = searchParams.get("doi")?.trim() || null
  const arxivId = searchParams.get("arxiv")?.trim() || null
  const title = searchParams.get("title")?.trim() || null

  if (!doi && !arxivId && !title) {
    return NextResponse.json({ error: "doi, arxiv veya title parametresi gerekli" }, { status: 400 })
  }

  const result = await bestLookup({ doi, arxivId, titleHint: title })

  if (!result) {
    // Nothing found — tell the client to keep the heuristic values
    return new NextResponse(null, { status: 204 })
  }

  return NextResponse.json(result)
}
