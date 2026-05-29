import pdf from "pdf-parse"

interface ExtractedPdfMetadata {
  title: string | null
  authors: string | null
  year: number | null
  abstract: string | null
  tags: string[]
  sourceUrl: string | null
  doi: string | null
  strategy: "crossref" | "heuristic"
}

const STOPWORDS = new Set([
  "abstract", "about", "after", "algorithm", "algorithms", "analysis", "and", "approach",
  "article", "based", "between", "can", "data", "deep", "design", "detection", "development",
  "effect", "effects", "from", "have", "into", "learning", "method", "methods", "model",
  "models", "paper", "research", "results", "study", "systems", "that", "their", "there",
  "these", "this", "using", "with", "yontem", "makale", "icin", "olarak", "uzerine",
  "veya", "ile", "olan", "gore", "daha", "from", "were", "been", "than", "such",
])

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

function cleanLine(line: string): string {
  return line.replace(/\s+/g, " ").trim()
}

function isPlausibleTitle(line: string): boolean {
  if (line.length < 12 || line.length > 220) return false
  if (/^(abstract|keywords?|introduction|references)\b/i.test(line)) return false
  if (/(doi|arxiv|http|www\.|@)/i.test(line)) return false
  if (/^\d+(\.\d+)?$/.test(line)) return false
  return /[A-Za-z]/.test(line)
}

function isLikelyAuthors(line: string): boolean {
  if (line.length < 5 || line.length > 180) return false
  if (/(abstract|keywords?|introduction|department|university|institute|faculty|doi|http|www\.|@)/i.test(line)) {
    return false
  }

  const tokens = line
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length < 2 || tokens.length > 20) return false

  const nameLikeCount = tokens.filter((token) => /^[A-Z][A-Za-z.'-]+$/.test(token)).length
  return nameLikeCount >= 2 || /,| and | & /.test(line)
}

function extractTitle(lines: string[], metadataTitle?: string | null): string | null {
  const metadataCandidate = metadataTitle?.trim()
  if (metadataCandidate && isPlausibleTitle(metadataCandidate) && !/^(untitled|microsoft word)/i.test(metadataCandidate)) {
    return metadataCandidate
  }

  const candidates = lines.slice(0, 12).filter(isPlausibleTitle)
  if (candidates.length === 0) return null

  const [first, second] = candidates
  if (second && first.length < 120 && second.length < 120) {
    return `${first} ${second}`.trim()
  }

  return first
}

function extractAuthors(lines: string[], title: string | null, metadataAuthor?: string | null): string | null {
  const metadataCandidate = metadataAuthor?.trim()
  if (metadataCandidate && isLikelyAuthors(metadataCandidate)) {
    return metadataCandidate
  }

  const titleIndex = title ? lines.findIndex((line) => line.includes(title)) : -1
  const searchStart = titleIndex >= 0 ? titleIndex + 1 : 0
  const window = lines.slice(searchStart, searchStart + 6)
  const authorsLine = window.find(isLikelyAuthors)
  return authorsLine ?? null
}

function extractYear(text: string, infoDate?: string | null): number | null {
  const currentYear = new Date().getFullYear() + 1

  if (infoDate) {
    const match = infoDate.match(/(19|20)\d{2}/)
    if (match) {
      const year = Number(match[0])
      if (year >= 1900 && year <= currentYear) return year
    }
  }

  const matches = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((match) => Number(match[0]))
  const valid = matches.filter((year) => year >= 1900 && year <= currentYear)
  return valid[0] ?? null
}

function extractAbstract(text: string): string | null {
  const match = text.match(
    /abstract[\s:.-]*([\s\S]{80,3000}?)(?:\n\s*(keywords?|index terms|introduction|1\.|i\.)\b)/i
  )

  if (!match) return null

  return normalizeWhitespace(match[1]).slice(0, 3000)
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/&[^;\s]+;/g, " ").replace(/\s+/g, " ").trim()
}

function extractDoi(text: string): string | null {
  const doiMatch = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i)
  if (!doiMatch) return null

  return doiMatch[0].replace(/[)>.,;]+$/, "")
}

interface CrossrefAuthor {
  given?: string
  family?: string
  name?: string
}

interface CrossrefMessage {
  DOI?: string
  title?: string[]
  author?: CrossrefAuthor[]
  abstract?: string
  subject?: string[]
  URL?: string
  issued?: { "date-parts"?: number[][] }
  published?: { "date-parts"?: number[][] }
  published_print?: { "date-parts"?: number[][] }
  published_online?: { "date-parts"?: number[][] }
}

function formatCrossrefAuthors(authors: CrossrefAuthor[] | undefined): string | null {
  if (!authors || authors.length === 0) return null

  const names = authors
    .map((author) => {
      if (author.name?.trim()) return author.name.trim()

      const parts = [author.given?.trim(), author.family?.trim()].filter(Boolean)
      return parts.join(" ").trim()
    })
    .filter(Boolean)

  return names.length > 0 ? names.join(", ") : null
}

function extractCrossrefYear(message: CrossrefMessage): number | null {
  const candidates = [
    message.issued?.["date-parts"]?.[0]?.[0],
    message.published?.["date-parts"]?.[0]?.[0],
    message.published_print?.["date-parts"]?.[0]?.[0],
    message.published_online?.["date-parts"]?.[0]?.[0],
  ]

  const year = candidates.find((candidate) => typeof candidate === "number")
  return typeof year === "number" ? year : null
}

async function fetchCrossrefMetadata(doi: string): Promise<Partial<ExtractedPdfMetadata> | null> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    })

    if (!res.ok) return null

    const payload = await res.json() as { message?: CrossrefMessage }
    const message = payload.message
    if (!message) return null

    const title = message.title?.[0]?.trim() || null
    const authors = formatCrossrefAuthors(message.author)
    const abstract = message.abstract ? stripHtml(message.abstract).slice(0, 3000) : null
    const tags = uniqueTags((message.subject ?? []).slice(0, 6))
    const sourceUrl = message.URL?.trim() || `https://doi.org/${doi}`
    const year = extractCrossrefYear(message)

    return {
      title,
      authors,
      year,
      abstract,
      tags,
      sourceUrl,
      doi: message.DOI?.trim() || doi,
      strategy: "crossref",
    }
  } catch {
    return null
  }
}

function deriveTags(title: string | null, abstract: string | null, text: string): string[] {
  const keywordMatch = text.match(/keywords?[\s:.-]+([^\n]+)/i)
  if (keywordMatch?.[1]) {
    return uniqueTags(
      keywordMatch[1]
        .split(/[,;|]/)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length >= 3)
        .slice(0, 6)
    )
  }

  const corpus = `${title ?? ""} ${abstract ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word))

  const counts = new Map<string, number>()
  corpus.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1))

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
}

export async function extractPdfMetadata(data: Uint8Array): Promise<ExtractedPdfMetadata> {
  const result = await pdf(Buffer.from(data), { max: 3 })
  const text = normalizeWhitespace(result.text ?? "")
  const lines = text
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)

  const info = (result.info ?? {}) as Record<string, string | undefined>
  const title = extractTitle(lines, info.Title ?? null)
  const authors = extractAuthors(lines, title, info.Author ?? null)
  const abstract = extractAbstract(text)
  const year = extractYear(text, info.CreationDate ?? null)
  const tags = deriveTags(title, abstract, text)
  const doi = extractDoi(text)

  if (doi) {
    const crossrefMetadata = await fetchCrossrefMetadata(doi)
    if (crossrefMetadata) {
      return {
        title: crossrefMetadata.title ?? title,
        authors: crossrefMetadata.authors ?? authors,
        year: crossrefMetadata.year ?? year,
        abstract: crossrefMetadata.abstract ?? abstract,
        tags: crossrefMetadata.tags?.length ? crossrefMetadata.tags : tags,
        sourceUrl: crossrefMetadata.sourceUrl ?? `https://doi.org/${doi}`,
        doi: crossrefMetadata.doi ?? doi,
        strategy: "crossref",
      }
    }
  }

  return {
    title,
    authors,
    year,
    abstract,
    tags,
    sourceUrl: doi ? `https://doi.org/${doi}` : null,
    doi,
    strategy: "heuristic",
  }
}
