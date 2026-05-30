"use client"

import { useCallback, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FieldWithChildren } from "@/types/database"
import type { AuthorWithCount } from "@/types/database"

const ALL_FIELDS_VALUE = "all"

// Flatten recursive field tree into a flat list with indented labels
function flattenFields(
  fields: FieldWithChildren[],
  depth = 0
): Array<{ id: string; label: string }> {
  return fields.flatMap((f) => [
    { id: f.id, label: "  ".repeat(depth) + (depth > 0 ? "↳ " : "") + f.name },
    ...flattenFields(f.children, depth + 1),
  ])
}

export function ArticleFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const q = searchParams.get("q") ?? ""
  const fieldId = searchParams.get("field_id") ?? ""
  const tagsParam = searchParams.get("tags") ?? ""
  const authorsParam = searchParams.get("authors") ?? ""
  const yearMin = searchParams.get("year_min") ?? ""
  const yearMax = searchParams.get("year_max") ?? ""

  const selectedTagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : []
  const selectedAuthorIds = authorsParam ? authorsParam.split(",").filter(Boolean) : []

  const [authorSearch, setAuthorSearch] = useState("")
  const [showAuthorSuggestions, setShowAuthorSuggestions] = useState(false)

  const { data: fields = [] } = useQuery<FieldWithChildren[]>({
    queryKey: ["fields"],
    queryFn: () => fetch("/api/fields").then((r) => r.json()),
  })

  const { data: allTags = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["tags", "all"],
    queryFn: () => fetch("/api/tags").then((r) => r.json()),
  })

  const { data: authorSuggestions = [] } = useQuery<AuthorWithCount[]>({
    queryKey: ["authors", authorSearch],
    queryFn: () => fetch(`/api/authors?q=${encodeURIComponent(authorSearch)}`).then((r) => r.json()),
    enabled: authorSearch.length > 0,
  })

  // Pre-fetch selected authors' names for display
  const { data: selectedAuthors = [] } = useQuery<AuthorWithCount[]>({
    queryKey: ["authors-selected", selectedAuthorIds.join(",")],
    queryFn: () =>
      selectedAuthorIds.length > 0
        ? fetch(`/api/authors?q=`).then((r) => r.json())
        : Promise.resolve([]),
    enabled: selectedAuthorIds.length > 0,
    select: (data) => data.filter((a) => selectedAuthorIds.includes(a.id)),
  })

  const flatFields = flattenFields(fields)

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const toggleTag = (tagId: string) => {
    const current = new Set(selectedTagIds)
    current.has(tagId) ? current.delete(tagId) : current.add(tagId)
    updateParam("tags", [...current].join(","))
  }

  const addAuthor = (authorId: string) => {
    if (!selectedAuthorIds.includes(authorId)) {
      updateParam("authors", [...selectedAuthorIds, authorId].join(","))
    }
    setAuthorSearch("")
    setShowAuthorSuggestions(false)
  }

  const removeAuthor = (authorId: string) => {
    updateParam("authors", selectedAuthorIds.filter((id) => id !== authorId).join(","))
  }

  const clearAll = () => router.push(pathname)

  const hasFilters = q || fieldId || tagsParam || authorsParam || yearMin || yearMax

  // Find label for currently selected field
  const selectedFieldLabel = flatFields.find((f) => f.id === fieldId)?.label?.trim() ?? ""

  return (
    <aside className="w-full md:w-64 md:shrink-0 space-y-4">
      {/* Search */}
      <div className="space-y-2">
        <Label>Arama</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Başlık, yazar, özet..."
            value={q}
            onChange={(e) => updateParam("q", e.target.value)}
            className="pl-8"
          />
          {q && (
            <button
              onClick={() => updateParam("q", "")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Separator />

      {/* Field filter — flat recursive list */}
      <div className="space-y-2">
        <Label>Alan</Label>
        <Select
          value={fieldId || ALL_FIELDS_VALUE}
          onValueChange={(v) => updateParam("field_id", v === ALL_FIELDS_VALUE ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tüm alanlar">
              {fieldId ? selectedFieldLabel || "Alan seçildi" : "Tüm Alanlar"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FIELDS_VALUE}>Tüm Alanlar</SelectItem>
            {flatFields.map(({ id, label }) => (
              <SelectItem key={id} value={id} className="font-mono text-sm">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Author filter — multi-select, AND semantics (same as tags) */}
      <div className="space-y-2">
        <Label>Yazarlar</Label>
        <p className="text-xs text-muted-foreground -mt-1">
          Birden fazla seçilirse AND filtresi uygulanır
        </p>
        {/* Selected author badges */}
        {selectedAuthorIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedAuthorIds.map((id) => {
              const found = selectedAuthors.find((a) => a.id === id)
              return (
                <Badge key={id} variant="default" className="gap-1 pr-1 text-xs">
                  {found?.name ?? id.slice(0, 8)}
                  <button
                    type="button"
                    onClick={() => removeAuthor(id)}
                    className="rounded-full hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )
            })}
          </div>
        )}
        {/* Author search */}
        <div className="relative">
          <Input
            placeholder="Yazar ara..."
            value={authorSearch}
            onChange={(e) => { setAuthorSearch(e.target.value); setShowAuthorSuggestions(true) }}
            onFocus={() => setShowAuthorSuggestions(true)}
            onBlur={() => setTimeout(() => setShowAuthorSuggestions(false), 150)}
            className="text-sm"
          />
          {showAuthorSuggestions && authorSearch && authorSuggestions.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
              <ul className="py-1 max-h-48 overflow-y-auto">
                {authorSuggestions
                  .filter((a) => !selectedAuthorIds.includes(a.id))
                  .map((a) => (
                    <li
                      key={a.id}
                      onMouseDown={() => addAuthor(a.id)}
                      className="flex items-center justify-between cursor-pointer px-3 py-1.5 text-sm hover:bg-accent"
                    >
                      <span>{a.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{a.article_count}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Year range */}
      <div className="space-y-2">
        <Label>Yıl Aralığı</Label>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            placeholder="1990"
            value={yearMin}
            onChange={(e) => updateParam("year_min", e.target.value)}
            className="w-24"
            min={1900}
            max={2100}
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="number"
            placeholder="2025"
            value={yearMax}
            onChange={(e) => updateParam("year_max", e.target.value)}
            className="w-24"
            min={1900}
            max={2100}
          />
        </div>
      </div>

      <Separator />

      {/* Tags */}
      <div className="space-y-2">
        <Label>Etiketler</Label>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => {
            const selected = selectedTagIds.includes(tag.id)
            return (
              <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}>
                <Badge
                  variant={selected ? "default" : "outline"}
                  className="cursor-pointer text-xs hover:opacity-80 transition-opacity"
                >
                  {tag.name}
                </Badge>
              </button>
            )
          })}
          {allTags.length === 0 && (
            <p className="text-xs text-muted-foreground">Henüz etiket yok</p>
          )}
        </div>
        {selectedTagIds.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedTagIds.length} etiket seçili (VE filtresi)
          </p>
        )}
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <>
          <Separator />
          <Button variant="outline" size="sm" className="w-full" onClick={clearAll}>
            <X className="h-4 w-4 mr-2" />
            Filtreleri Temizle
          </Button>
        </>
      )}
    </aside>
  )
}
