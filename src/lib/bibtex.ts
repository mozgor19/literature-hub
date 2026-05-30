export interface ArticleForBibtex {
  title: string
  authors: string
  year: number | null
  source_url?: string | null
  organizations?: Array<{ name: string }> | null
  normalized_authors?: Array<{ name: string }> | null
}

const FOLD: Record<string, string> = {
  ç: "c", Ç: "C", ş: "s", Ş: "S", ğ: "g", Ğ: "G",
  ı: "i", İ: "I", ö: "o", Ö: "O", ü: "u", Ü: "U",
}

function asciiFold(s: string): string {
  return s
    .replace(/[çÇşŞğĞıİöÖüÜ]/g, (c) => FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
}

function makeCitekey(article: ArticleForBibtex, used: Set<string>): string {
  try {
    const firstName =
      article.normalized_authors?.[0]?.name ??
      article.authors.split(",")[0]?.trim() ??
      ""
    const lastName = firstName.trim().split(/\s+/).pop() ?? "unknown"
    const year = article.year != null ? String(article.year) : "nd"
    const word = article.title.trim().split(/\s+/)[0] ?? "unknown"
    const base =
      asciiFold(lastName.toLowerCase()) + year + asciiFold(word.toLowerCase())

    if (!used.has(base)) {
      used.add(base)
      return base
    }
    for (const ch of "abcdefghijklmnopqrstuvwxyz") {
      const c = base + ch
      if (!used.has(c)) {
        used.add(c)
        return c
      }
    }
    const fb = `${base}_${Math.random().toString(36).slice(2, 6)}`
    used.add(fb)
    return fb
  } catch {
    return `entry${Math.random().toString(36).slice(2, 6)}`
  }
}

function formatAuthors(article: ArticleForBibtex): string {
  if (article.normalized_authors?.length) {
    return article.normalized_authors.map((a) => a.name).join(" and ")
  }
  return article.authors
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .join(" and ")
}

function isDoi(url: string): boolean {
  return (
    url.startsWith("https://doi.org/") ||
    url.startsWith("http://doi.org/") ||
    /^10\.\d{4,}\//.test(url)
  )
}

export function articleToBibtex(article: ArticleForBibtex, citekey: string): string {
  try {
    const hasDoi = !!(article.source_url && isDoi(article.source_url))
    const type = hasDoi || article.year != null ? "@article" : "@misc"

    const safeTitle = (article.title ?? "Unknown").replace(/[{}]/g, "")
    const lines: string[] = [`  title = {{${safeTitle}}}`]

    const authors = formatAuthors(article)
    if (authors) lines.push(`  author = {${authors}}`)
    if (article.year != null) lines.push(`  year = {${article.year}}`)

    if (article.source_url) {
      if (hasDoi) {
        const doi = article.source_url.replace(/^https?:\/\/doi\.org\//, "")
        lines.push(`  doi = {${doi}}`)
      } else {
        lines.push(`  url = {${article.source_url}}`)
      }
    }

    const orgs = (article.organizations ?? []).map((o) => o.name).filter(Boolean)
    if (orgs.length) lines.push(`  organization = {${orgs.join(", ")}}`)

    return `${type}{${citekey},\n${lines.join(",\n")}\n}`
  } catch {
    try {
      return `@misc{error,\n  title = {{${(article.title ?? "Unknown").replace(/[{}]/g, "")}}}\n}`
    } catch {
      return "@misc{error,\n  title = {{Unknown}}\n}"
    }
  }
}

export function articlesToBibtex(articles: ArticleForBibtex[]): string {
  const used = new Set<string>()
  return articles
    .map((a) => articleToBibtex(a, makeCitekey(a, used)))
    .join("\n\n")
}
