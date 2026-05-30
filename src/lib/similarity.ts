// Dice coefficient (bigram) similarity — same algorithm PostgreSQL pg_trgm uses.
// No external dependency; sufficient for a small research-group library.

const FOLD: Record<string, string> = {
  ç: "c", Ç: "C", ş: "s", Ş: "S", ğ: "g", Ğ: "G",
  ı: "i", İ: "I", ö: "o", Ö: "O", ü: "u", Ü: "U",
}

export function normalizeTitle(s: string): string {
  return s
    .replace(/[çÇşŞğĞıİöÖüÜ]/g, (c) => FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function normalizeDoi(url: string | null | undefined): string | null {
  if (!url) return null
  const s = url.trim().toLowerCase()
  for (const prefix of ["https://doi.org/", "http://doi.org/", "doi:"]) {
    if (s.startsWith(prefix)) return s.slice(prefix.length).trim()
  }
  // Bare DOI (starts with 10.)
  if (/^10\.\d{4,}\//.test(s)) return s
  return null
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2)
    m.set(bg, (m.get(bg) ?? 0) + 1)
  }
  return m
}

export function diceSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return 0

  const ba = bigrams(na)
  const bb = bigrams(nb)

  let intersection = 0
  for (const [bg, cnt] of ba) {
    intersection += Math.min(cnt, bb.get(bg) ?? 0)
  }

  const total = na.length - 1 + (nb.length - 1)
  return total === 0 ? 0 : (2 * intersection) / total
}

export const TITLE_SIM_THRESHOLD = 0.85
