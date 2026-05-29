"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { DBTag, FieldWithChildren } from "@/types/database"
import { useCallback } from "react"

const ALL_FIELDS_VALUE = "all"
const NO_SUBFIELD_VALUE = "__none__"

export function ArticleFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const q = searchParams.get("q") ?? ""
  const fieldId = searchParams.get("field_id") ?? ""
  const tagsParam = searchParams.get("tags") ?? ""
  const yearMin = searchParams.get("year_min") ?? ""
  const yearMax = searchParams.get("year_max") ?? ""

  const selectedTagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : []

  const { data: fields = [] } = useQuery<FieldWithChildren[]>({
    queryKey: ["fields"],
    queryFn: () => fetch("/api/fields").then((r) => r.json()),
  })

  const { data: allTags = [] } = useQuery<DBTag[]>({
    queryKey: ["tags", "all"],
    queryFn: () => fetch("/api/tags").then((r) => r.json()),
  })

  const selectedTopField =
    fields.find((field) => field.id === fieldId) ??
    fields.find((field) => field.children.some((child) => child.id === fieldId)) ??
    null

  const selectedTopFieldId = selectedTopField?.id ?? ""
  const selectedSubFieldId =
    selectedTopField && selectedTopField.id !== fieldId ? fieldId : ""
  const subfields = selectedTopField?.children ?? []

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page") // reset pagination on filter change
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const toggleTag = (tagId: string) => {
    const current = new Set(selectedTagIds)
    if (current.has(tagId)) {
      current.delete(tagId)
    } else {
      current.add(tagId)
    }
    updateParam("tags", [...current].join(","))
  }

  const clearAll = () => {
    router.push(pathname)
  }

  const hasFilters = q || fieldId || tagsParam || yearMin || yearMax

  return (
    <aside className="w-64 shrink-0 space-y-4">
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

      {/* Field filter */}
      <div className="space-y-2">
        <Label>Alan</Label>
        <Select
          value={selectedTopFieldId || ALL_FIELDS_VALUE}
          onValueChange={(value) => {
            if (value === ALL_FIELDS_VALUE) {
              updateParam("field_id", "")
              return
            }

            updateParam("field_id", value)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tüm alanlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FIELDS_VALUE}>Tüm Alanlar</SelectItem>
            {fields.map((field) => (
              <SelectItem key={field.id} value={field.id}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedTopField && subfields.length > 0 && (
          <div className="space-y-2 pt-2">
            <Label className="text-xs text-muted-foreground">Alt Alan</Label>
            <Select
              value={selectedSubFieldId || NO_SUBFIELD_VALUE}
              onValueChange={(value) => {
                if (value === NO_SUBFIELD_VALUE) {
                  updateParam("field_id", selectedTopField.id)
                  return
                }

                updateParam("field_id", value)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alt alan seçin..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUBFIELD_VALUE}>Tüm {selectedTopField.name}</SelectItem>
                {subfields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
