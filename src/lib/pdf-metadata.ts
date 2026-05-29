import pdf from "pdf-parse"

// ─── Public types ─────────────────────────────────────────────────────────────

export type FieldSource = "embedded" | "heuristic"

export interface HeuristicResult {
  title: string | null
  authors: string | null
  year: number | null
  abstract: string | null
  tags: string[]
  doi: string | null
  arxivId: string | null
  /** Sources map: which extraction method produced each filled field */
  fieldSources: Partial<Record<"title" | "authors" | "year" | "abstract" | "tags", FieldSource>>
}

// ─── DOI / arXiv extraction ───────────────────────────────────────────────────

// DOI character class: everything except whitespace and delimiters
// (covers the vast majority of real-world DOIs)
const DOI_CHAR = "[^\\s\"'<>[\\]{}|\\\\^`]"

const DOI_PATTERNS = [
  // Explicit URL: (https?://)?doi.org/10.xxxx/...
  new RegExp(`(?:https?:\\/\\/)?doi\\.org\\/(10\\.\\d{4,9}\\/${DOI_CHAR}+)`, "gi"),
  // Labelled: DOI: 10.xxxx/...
  new RegExp(`\\bDOI:\\s*(10\\.\\d{4,9}\\/${DOI_CHAR}+)`, "gi"),
  // Bare: 10.xxxx/... (least reliable — checked last)
  new RegExp(`\\b(10\\.\\d{4,9}\\/${DOI_CHAR}+)`, "gi"),
]

const ARXIV_PATTERNS = [
  // Standard: arXiv:2301.12345v2
  /arXiv:(\d{4}\.\d{4,5}(?:v\d+)?)/i,
  // URL: arxiv.org/abs/2301.12345
  /arxiv\.org\/abs\/(\d{4}\.\d{4,5}(?:v\d+)?)/i,
  // Old-style: arXiv:hep-ph/0306066
  /arXiv:([a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)/i,
]

function cleanDoi(raw: string): string {
  return raw.replace(/[.,;:)>\]]+$/, "").trim()
}

/** Try every DOI pattern against every candidate string; return first match. */
export function extractDoi(candidates: string[]): string | null {
  for (const target of candidates) {
    for (const pattern of DOI_PATTERNS) {
      pattern.lastIndex = 0
      const m = pattern.exec(target)
      if (m?.[1]) return cleanDoi(m[1])
    }
  }
  return null
}

export function extractArxivId(candidates: string[]): string | null {
  for (const target of candidates) {
    for (const pattern of ARXIV_PATTERNS) {
      const m = target.match(pattern)
      if (m?.[1]) return m[1].replace(/v\d+$/, "") // strip version suffix
    }
  }
  return null
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function normalizeWs(text: string): string {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

function cleanLine(line: string): string {
  return line.replace(/\s+/g, " ").trim()
}

// ─── Title extraction ─────────────────────────────────────────────────────────

function isPlausibleTitle(line: string): boolean {
  if (line.length < 12 || line.length > 220) return false
  if (/^(abstract|keywords?|introduction|references|acknowledgements?)\b/i.test(line)) return false
  if (/(doi\.org|arxiv\.org|http:|https:|@|\d{4}[\-/]\d)/i.test(line)) return false
  if (/^\d+(\.\d+)?$/.test(line)) return false
  return /[A-Za-z]{4,}/.test(line) // at least one real word
}

function looksLikeAuthors(line: string): boolean {
  // Fast reject: too short/long, contains institution markers
  if (line.length < 5 || line.length > 200) return false
  if (/(university|institute|department|laboratory|school|centre|center|college)\b/i.test(line)) return false

  const tokens = line.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean)
  if (tokens.length < 2 || tokens.length > 18) return false

  // Require at least 2 capitalised-name tokens
  const nameLike = tokens.filter(t => /^[A-ZÀ-Ü][a-zà-ü.'-]{1,}$/.test(t)).length
  return nameLike >= 2 || /\band\b|\&/.test(line)
}

function extractTitle(lines: string[], embeddedTitle?: string | null): {
  title: string | null
  source: FieldSource | null
} {
  // Layer 1: embedded PDF metadata
  const embedded = embeddedTitle?.trim()
  if (
    embedded &&
    isPlausibleTitle(embedded) &&
    !/^(untitled|microsoft word|unnamed|new document)/i.test(embedded)
  ) {
    return { title: embedded, source: "embedded" }
  }

  // Layer 2: first plausible line from page text
  const candidates = lines.slice(0, 14).filter(isPlausibleTitle)
  if (candidates.length === 0) return { title: null, source: null }

  const first = candidates[0]
  const second = candidates[1]

  // Concatenate only if the second candidate is NOT author-like and is short
  if (second && second.length < 100 && !looksLikeAuthors(second)) {
    return { title: `${first} ${second}`.trim(), source: "heuristic" }
  }

  return { title: first, source: "heuristic" }
}

// ─── Author extraction ────────────────────────────────────────────────────────

function extractAuthors(
  lines: string[],
  title: string | null,
  embeddedAuthor?: string | null
): { authors: string | null; source: FieldSource | null } {
  const embedded = embeddedAuthor?.trim()
  if (embedded && looksLikeAuthors(embedded)) {
    return { authors: embedded, source: "embedded" }
  }

  // Search the few lines after the title
  const titleIdx = title
    ? lines.findIndex(l => l.toLowerCase().includes(title.toLowerCase().slice(0, 30)))
    : -1
  const searchFrom = titleIdx >= 0 ? titleIdx + 1 : 0
  const window = lines.slice(searchFrom, searchFrom + 8)
  const found = window.find(looksLikeAuthors)
  return found ? { authors: found, source: "heuristic" } : { authors: null, source: null }
}

// ─── Year extraction ──────────────────────────────────────────────────────────

function extractYear(
  text: string,
  infoDate?: string | null
): { year: number | null; source: FieldSource | null } {
  const currentYear = new Date().getFullYear() + 1
  const isValid = (y: number) => y >= 1900 && y <= currentYear

  // Prefer embedded creation/modification date
  if (infoDate) {
    const m = infoDate.match(/(19|20)\d{2}/)
    if (m) {
      const y = Number(m[0])
      if (isValid(y)) return { year: y, source: "embedded" }
    }
  }

  // High-confidence patterns in text (publication date contexts)
  const highConfidencePatterns = [
    /\(\s*((?:19|20)\d{2})\s*\)/g,          // (2024)
    /(?:Published|Received|Accepted|©|Copyright)[^.]{0,40}?\b((?:19|20)\d{2})\b/gi,
    /\b((?:19|20)\d{2})\s*[;,]\s*(?:vol|volume|\d+\s*[:(])/gi,
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+((?:19|20)\d{2})\b/gi,
  ]

  for (const pattern of highConfidencePatterns) {
    for (const m of text.matchAll(pattern)) {
      const y = Number(m[1])
      if (isValid(y)) return { year: y, source: "heuristic" }
    }
  }

  // Fall back: first year-like number in the text
  for (const m of text.matchAll(/\b((?:19|20)\d{2})\b/g)) {
    const y = Number(m[1])
    if (isValid(y)) return { year: y, source: "heuristic" }
  }

  return { year: null, source: null }
}

// ─── Abstract extraction ─────────────────────────────────────────────────────

function extractAbstract(text: string): string | null {
  // Match "Abstract" header (with or without trailing colon/dash)
  // and capture text until the next major section heading
  const terminators = [
    "keywords?",
    "index terms?",
    "1\\.?\\s+introduction",
    "introduction",
    "i\\.\\s+introduction",
    "1\\s+introduction",
  ].join("|")

  const match = text.match(
    new RegExp(
      `\\bAbstract\\b[\\s:—–-]*((?:[\\s\\S](?!(?:${terminators})\\b)){80,2500})`,
      "i"
    )
  )
  if (match?.[1]) {
    return normalizeWs(match[1]).slice(0, 2000)
  }
  return null
}

// ─── Keyword / tag extraction ─────────────────────────────────────────────────

const GENERIC_WORDS = new Set([
  "abstract", "algorithm", "analysis", "approach", "article", "based", "between",
  "data", "deep", "design", "detection", "development", "effect", "from", "have",
  "into", "learning", "method", "model", "models", "paper", "performance", "problem",
  "proposed", "results", "review", "show", "study", "system", "systems", "technique",
  "that", "their", "these", "this", "using", "various", "with", "work",
])

function deriveTags(title: string | null, abstract: string | null, fullText: string): {
  tags: string[]
  source: FieldSource
} {
  // First choice: explicit keywords section
  const kwMatch = fullText.match(/(?:keywords?|index terms?)[\s:—–-]+([^\n]{10,300})/i)
  if (kwMatch?.[1]) {
    const kws = kwMatch[1]
      .split(/[,;|•·]/)
      .map(k => k.trim().toLowerCase().replace(/\s+/g, " "))
      .filter(k => k.length >= 3 && k.length <= 50 && !/^\d+$/.test(k))
      .slice(0, 8)
    if (kws.length >= 2) return { tags: kws, source: "heuristic" }
  }

  // Fallback: significant bigrams + single nouns from title + abstract
  const corpus = `${title ?? ""} ${abstract ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()

  if (!corpus) return { tags: [], source: "heuristic" }

  const words = corpus.split(/\s+/).filter(w => w.length >= 4 && !GENERIC_WORDS.has(w))
  const counts = new Map<string, number>()
  words.forEach(w => counts.set(w, (counts.get(w) ?? 0) + 1))

  // Only keep words that appear more than once (meaningful terms)
  const tags = [...counts.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w)

  return { tags, source: "heuristic" }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function extractPdfHeuristics(data: Uint8Array): Promise<HeuristicResult> {
  let result: Awaited<ReturnType<typeof pdf>>
  try {
    // Parse up to 5 pages: enough for most DOIs and abstracts, not too slow
    result = await pdf(Buffer.from(data), { max: 5 })
  } catch {
    // Scanned / corrupted PDF — return empty result
    return {
      title: null, authors: null, year: null, abstract: null,
      tags: [], doi: null, arxivId: null, fieldSources: {},
    }
  }

  const text = normalizeWs(result.text ?? "")
  const lines = text.split("\n").map(cleanLine).filter(Boolean)
  const info = (result.info ?? {}) as Record<string, string | undefined>

  // Collect all candidate strings for DOI/arXiv search
  const searchCandidates = [
    text,
    info.Subject ?? "",
    info.Keywords ?? "",
    info.Title ?? "",
  ]

  const doi = extractDoi(searchCandidates)
  const arxivId = extractArxivId(searchCandidates)

  const titleResult = extractTitle(lines, info.Title)
  const authorsResult = extractAuthors(lines, titleResult.title, info.Author)
  const yearResult = extractYear(text, info.CreationDate ?? info.ModDate)
  const abstract = extractAbstract(text)
  const tagsResult = deriveTags(titleResult.title, abstract, text)

  const fieldSources: HeuristicResult["fieldSources"] = {}
  if (titleResult.source) fieldSources.title = titleResult.source
  if (authorsResult.source) fieldSources.authors = authorsResult.source
  if (yearResult.source) fieldSources.year = yearResult.source
  if (abstract) fieldSources.abstract = "heuristic"
  if (tagsResult.tags.length > 0) fieldSources.tags = tagsResult.source

  return {
    title: titleResult.title,
    authors: authorsResult.authors,
    year: yearResult.year,
    abstract,
    tags: tagsResult.tags,
    doi,
    arxivId,
    fieldSources,
  }
}
