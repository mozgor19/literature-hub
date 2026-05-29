"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArticleFilters } from "./ArticleFilters"
import { ArticleTable } from "./ArticleTable"
import type { ArticleWithRelations } from "@/types/database"

interface ArticlesResponse {
  articles: ArticleWithRelations[]
  total: number
  page: number
  limit: number
}

export function ArticleBrowser() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const fieldId = searchParams.get("field_id") ?? ""
  const tags = searchParams.get("tags") ?? ""
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

  return (
    <div className="flex gap-6">
      <ArticleFilters />
      <div className="flex-1 min-w-0">
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
  )
}
