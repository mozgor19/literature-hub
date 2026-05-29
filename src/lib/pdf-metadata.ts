import { PDFParse } from "pdf-parse"

interface ExtractedPdfMetadata {
  title: string | null
  authors: string | null
  year: number | null
  abstract: string | null
  tags: string[]
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

export async function extractPdfMetadata(buffer: Buffer): Promise<ExtractedPdfMetadata> {
  const parser = new PDFParse({ data: buffer })

  try {
    const [infoResult, textResult] = await Promise.all([
      parser.getInfo(),
      parser.getText({ first: 3 }),
    ])

    const text = normalizeWhitespace(textResult.text)
    const lines = text
      .split("\n")
      .map(cleanLine)
      .filter(Boolean)

    const title = extractTitle(lines, infoResult.info?.Title ?? null)
    const authors = extractAuthors(lines, title, infoResult.info?.Author ?? null)
    const abstract = extractAbstract(text)
    const year = extractYear(text, infoResult.info?.CreationDate ?? null)
    const tags = deriveTags(title, abstract, text)

    return { title, authors, year, abstract, tags }
  } finally {
    await parser.destroy()
  }
}

