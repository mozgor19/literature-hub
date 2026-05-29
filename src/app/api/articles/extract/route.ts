import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { extractPdfHeuristics } from "@/lib/pdf-metadata"

export const runtime = "nodejs"

/**
 * POST /api/articles/extract
 *
 * Fast heuristic parse — no external network calls.
 * Returns detected DOI / arXiv ID for the client to call
 * GET /api/articles/lookup afterwards, keeping the form non-blocking.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "PDF dosyası zorunludur" }, { status: 400 })

  try {
    const buf = await file.arrayBuffer()
    const result = await extractPdfHeuristics(new Uint8Array(buf))
    return NextResponse.json(result)
  } catch (err) {
    console.error("PDF heuristic extraction failed:", err)
    // Return an empty-but-valid result so the form still opens
    return NextResponse.json({
      title: null, authors: null, year: null, abstract: null,
      tags: [], doi: null, arxivId: null, fieldSources: {},
    })
  }
}
