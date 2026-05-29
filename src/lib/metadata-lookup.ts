/**
 * Crossref + arXiv metadata lookup.
 *
 * All network calls include:
 *  - Polite User-Agent (CROSSREF_CONTACT_EMAIL env var)
 *  - 8-second AbortSignal timeout
 *  - Per-process in-memory cache (TTL: 24 h)
 *
 * The caller decides which source to try; this module never throws —
 * every function returns null on failure.
 */

export type LookupSource = "crossref" | "crossref-title" | "arxiv"
export type LookupFieldSource = "crossref" | "crossref-title" | "arxiv"

export interface LookupResult {
  title: string | null
  authors: string | null
  year: number | null
  abstract: string | null
  tags: string[]
  sourceUrl: string | null
  doi: string | null
  journal: string | null
  lookupSource: LookupSource
  fieldSources: Partial<Record<"title" | "authors" | "year" | "abstract" | "tags" | "journal", LookupFieldSource>>
}

// ─── In-process cache (per Vercel function instance, TTL 24 h) ───────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { data: LookupResult; ts: number }>()

function getCached(key: string): LookupResult | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null }
  return entry.data
}

function setCached(key: string, data: LookupResult): void {
  cache.set(key, { data, ts: Date.now() })
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function politeHeaders() {
  const email = process.env.CROSSREF_CONTACT_EMAIL ?? "noreply@example.com"
  return {
    "User-Agent": `LiteratureHub/1.0 (mailto:${email})`,
    Accept: "application/json",
  }
}

function timeout8s() {
  return AbortSignal.timeout(8000)
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/&[^;\s]+;/g, " ").replace(/\s+/g, " ").trim()
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean))]
}

function cleanDoi(raw: string): string {
  return raw.replace(/[.,;:)>\]]+$/, "").trim()
}

// ─── Crossref ─────────────────────────────────────────────────────────────────

interface CrossrefAuthor { given?: string; family?: string; name?: string }
interface CrossrefMessage {
  DOI?: string
  title?: string[]
  author?: CrossrefAuthor[]
  abstract?: string
  subject?: string[]
  URL?: string
  "container-title"?: string[]
  issued?: { "date-parts"?: number[][] }
  published?: { "date-parts"?: number[][] }
  published_print?: { "date-parts"?: number[][] }
  published_online?: { "date-parts"?: number[][] }
}

function parseCrossref(msg: CrossrefMessage, source: LookupSource): LookupResult {
  const title = msg.title?.[0]?.trim() ?? null
  const authors = msg.author
    ?.map(a => a.name?.trim() ?? [a.given, a.family].filter(Boolean).join(" ").trim())
    .filter(Boolean)
    .join(", ") ?? null
  const abstract = msg.abstract ? stripHtml(msg.abstract).slice(0, 2000) : null
  const tags = uniqueTags((msg.subject ?? []).slice(0, 8))
  const journal = msg["container-title"]?.[0]?.trim() ?? null
  const sourceUrl = msg.URL?.trim() ?? (msg.DOI ? `https://doi.org/${msg.DOI}` : null)
  const doi = msg.DOI ? cleanDoi(msg.DOI) : null

  const yearCandidates = [
    msg.issued?.["date-parts"]?.[0]?.[0],
    msg.published?.["date-parts"]?.[0]?.[0],
    msg.published_print?.["date-parts"]?.[0]?.[0],
    msg.published_online?.["date-parts"]?.[0]?.[0],
  ]
  const year = (yearCandidates.find(y => typeof y === "number") as number | undefined) ?? null

  const fieldSources: LookupResult["fieldSources"] = {}
  if (title) fieldSources.title = source
  if (authors) fieldSources.authors = source
  if (year) fieldSources.year = source
  if (abstract) fieldSources.abstract = source
  if (tags.length > 0) fieldSources.tags = source
  if (journal) fieldSources.journal = source

  return { title, authors, year, abstract, tags, sourceUrl, doi, journal, lookupSource: source, fieldSources }
}

export async function lookupByDoi(doi: string): Promise<LookupResult | null> {
  const cacheKey = `doi:${doi}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      { headers: politeHeaders(), signal: timeout8s() }
    )
    if (!res.ok) return null
    const payload = await res.json() as { message?: CrossrefMessage }
    if (!payload.message) return null
    const result = parseCrossref(payload.message, "crossref")
    setCached(cacheKey, result)
    return result
  } catch {
    return null
  }
}

// ─── Word-overlap similarity (Dice over 4+ char words) ───────────────────────

function similarity(a: string, b: string): number {
  const words = (s: string) => new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length >= 4)
  )
  const wa = words(a), wb = words(b)
  let shared = 0
  wa.forEach(w => wb.has(w) && shared++)
  return (wa.size + wb.size) > 0 ? (2 * shared) / (wa.size + wb.size) : 0
}

const TITLE_SEARCH_THRESHOLD = 0.60

export async function lookupByTitle(title: string): Promise<LookupResult | null> {
  const cacheKey = `title:${title.toLowerCase().slice(0, 80)}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const qs = new URLSearchParams({
      "query.title": title,
      rows: "3",
      select: "DOI,title,author,abstract,subject,issued,URL,container-title",
    })
    const res = await fetch(
      `https://api.crossref.org/works?${qs}`,
      { headers: politeHeaders(), signal: timeout8s() }
    )
    if (!res.ok) return null
    const payload = await res.json() as { message?: { items?: CrossrefMessage[] } }
    const items = payload.message?.items ?? []

    for (const item of items) {
      const candidateTitle = item.title?.[0] ?? ""
      if (similarity(title, candidateTitle) >= TITLE_SEARCH_THRESHOLD) {
        const result = parseCrossref(item, "crossref-title")
        setCached(cacheKey, result)
        return result
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── arXiv ────────────────────────────────────────────────────────────────────

function parseArxivXml(xml: string): LookupResult | null {
  // Check if there's actually an entry (not an error response)
  if (!xml.includes("<entry>")) return null

  const get = (tag: string) =>
    xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim() ?? null

  const title = get("title")
  const summary = get("summary")
  const published = get("published")
  const year = published ? (() => { const y = Number(published.slice(0, 4)); return y >= 1900 ? y : null })() : null

  const authorMatches = [...xml.matchAll(/<author[^>]*>[\s\S]*?<name>([\s\S]+?)<\/name>[\s\S]*?<\/author>/g)]
  const authors = authorMatches.map(m => m[1].trim()).filter(Boolean).join(", ") || null

  const doiRaw = get("arxiv:doi")
  const doi = doiRaw ? cleanDoi(doiRaw) : null
  const idMatch = xml.match(/<id>(https?:\/\/arxiv\.org\/abs\/[^<v]+)/)
  const sourceUrl = idMatch?.[1] ?? (doi ? `https://doi.org/${doi}` : null)

  if (!title && !authors) return null

  const fieldSources: LookupResult["fieldSources"] = {}
  if (title) fieldSources.title = "arxiv"
  if (authors) fieldSources.authors = "arxiv"
  if (year) fieldSources.year = "arxiv"
  if (summary) fieldSources.abstract = "arxiv"

  return {
    title, authors, year,
    abstract: summary?.slice(0, 2000) ?? null,
    tags: [],
    sourceUrl, doi, journal: null,
    lookupSource: "arxiv",
    fieldSources,
  }
}

export async function lookupByArxivId(arxivId: string): Promise<LookupResult | null> {
  // Strip version suffix for the cache key but use bare ID for the API
  const baseId = arxivId.replace(/v\d+$/, "")
  const cacheKey = `arxiv:${baseId}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(baseId)}`,
      {
        headers: { "User-Agent": `LiteratureHub/1.0 (mailto:${process.env.CROSSREF_CONTACT_EMAIL ?? "noreply@example.com"})` },
        signal: timeout8s(),
      }
    )
    if (!res.ok) return null
    const xml = await res.text()
    const result = parseArxivXml(xml)
    if (result) setCached(cacheKey, result)
    return result
  } catch {
    return null
  }
}

// ─── Convenience: try all available sources for a given set of IDs ────────────

export async function bestLookup(opts: {
  doi?: string | null
  arxivId?: string | null
  titleHint?: string | null
}): Promise<LookupResult | null> {
  const { doi, arxivId, titleHint } = opts

  // Run DOI and arXiv lookups in parallel when both are available
  if (doi && arxivId) {
    const [doiResult, arxivResult] = await Promise.all([
      lookupByDoi(doi),
      lookupByArxivId(arxivId),
    ])
    // Prefer DOI result (more authoritative metadata); fall back to arXiv
    return doiResult ?? arxivResult
  }

  if (doi) return await lookupByDoi(doi)
  if (arxivId) return await lookupByArxivId(arxivId)

  // Title search as last resort — only if we have a title guess
  if (titleHint && titleHint.length >= 12) {
    return await lookupByTitle(titleHint)
  }

  return null
}
