"use client"

import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { SlidersHorizontal, X, BookMarked, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ArticleFilters } from "./ArticleFilters"
import { ArticleTable } from "./ArticleTable"
import { BibtexDialog } from "@/components/bibtex/BibtexDialog"
import { articlesToBibtex, type ArticleForBibtex } from "@/lib/bibtex"
import type { ArticleWithRelations } from "@/types/database"

interface ArticlesResponse {
  articles: ArticleWithRelations[]
  total: number
  page: number
  limit: number
}

export function ArticleBrowser() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exportingBibtex, setExportingBibtex] = useState(false)
  const [bibtexDialog, setBibtexDialog] = useState<{ bibtex: string; filename: string } | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const fieldId = searchParams.get("field_id") ?? ""
  const tags = searchParams.get("tags") ?? ""
  const authors = searchParams.get("authors") ?? ""
  const orgs = searchParams.get("orgs") ?? ""
  const yearMin = searchParams.get("year_min") ?? ""
  const yearMax = searchParams.get("year_max") ?? ""
  const q = searchParams.get("q") ?? ""
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))

  const { data, isLoading } = useQuery<ArticlesResponse>({
    queryKey: ["articles", { fieldId, tags, yearMin, yearMax, q, page }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (fieldId) params.set("field_id", fieldId)
      if (tags) params.set("tags", tags)
      if (yearMin) params.set("year_min", yearMin)
      if (yearMax) params.set("year_max", yearMax)
      if (q) params.set("q", q)
      params.set("page", String(page))
      const res = await fetch(`/api/articles?${params}`)
      if (!res.ok) throw new Error("Makaleler yüklenemedi")
      return res.json()
    },
  })

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(newPage))
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleBibtexExport = async () => {
    setExportingBibtex(true)
    try {
      const all: ArticleForBibtex[] = []
      let p = 1
      while (true) {
        const params = new URLSearchParams()
        if (fieldId) params.set("field_id", fieldId)
        if (tags) params.set("tags", tags)
        if (authors) params.set("authors", authors)
        if (orgs) params.set("orgs", orgs)
        if (yearMin) params.set("year_min", yearMin)
        if (yearMax) params.set("year_max", yearMax)
        if (q) params.set("q", q)
        params.set("limit", "100")
        params.set("page", String(p++))
        const res = await fetch(`/api/articles?${params}`)
        if (!res.ok) throw new Error("Makaleler yüklenemedi")
        const d = await res.json() as { articles: ArticleForBibtex[]; total: number }
        all.push(...d.articles)
        if (all.length >= d.total || all.length >= 1000) break
      }
      setBibtexDialog({ bibtex: articlesToBibtex(all), filename: "makaleler.bib" })
    } catch {
      toast.error("BibTeX oluşturulamadı")
    } finally {
      setExportingBibtex(false)
    }
  }

  const hasFilters = !!(fieldId || tags || yearMin || yearMax || q)

  return (
    <div>
      {/* Mobile filter toggle */}
      <div className="md:hidden mb-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          {filtersOpen ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
          {filtersOpen ? "Filtreleri Kapat" : "Filtrele"}
          {hasFilters && !filtersOpen && (
            <span className="h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Filters: always visible on md+, toggled on mobile */}
        <div className={filtersOpen ? "block md:block" : "hidden md:block"}>
          <ArticleFilters />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBibtexExport}
              disabled={exportingBibtex || !data || data.total === 0}
            >
              {exportingBibtex ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <BookMarked className="h-4 w-4 mr-1.5" />
              )}
              BibTeX Dışa Aktar
            </Button>
          </div>
          <ArticleTable
            articles={data?.articles ?? []}
            isLoading={isLoading}
            total={data?.total ?? 0}
            page={page}
            limit={data?.limit ?? 25}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {bibtexDialog && (
        <BibtexDialog
          bibtex={bibtexDialog.bibtex}
          filename={bibtexDialog.filename}
          open={true}
          onOpenChange={(open) => !open && setBibtexDialog(null)}
        />
      )}
    </div>
  )
}
