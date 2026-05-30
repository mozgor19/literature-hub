"use client"

import { useState, useRef } from "react"
import { X, Plus } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import type { OrgWithCount } from "@/types/database"

export interface SelectedOrg {
  id: string | null
  name: string
}

export function OrgInput({ value, onChange }: { value: SelectedOrg[]; onChange: (orgs: SelectedOrg[]) => void }) {
  const [inputValue, setInputValue] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: suggestions = [] } = useQuery<OrgWithCount[]>({
    queryKey: ["orgs", inputValue],
    queryFn: () => fetch(`/api/organizations?q=${encodeURIComponent(inputValue)}`).then((r) => r.json()),
    enabled: inputValue.length > 0,
  })

  const selectedNames = new Set(value.map((o) => o.name.toLowerCase()))
  const filtered = suggestions.filter((s) => !selectedNames.has(s.name.toLowerCase()))

  const add = (org: SelectedOrg) => {
    if (!selectedNames.has(org.name.toLowerCase())) onChange([...value, org])
    setInputValue("")
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const addNew = () => {
    const name = inputValue.trim()
    if (!name || selectedNames.has(name.toLowerCase())) return
    add({ id: null, name })
  }

  const remove = (name: string) => onChange(value.filter((o) => o.name.toLowerCase() !== name.toLowerCase()))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (filtered.length > 0 && inputValue) add({ id: filtered[0].id, name: filtered[0].name })
      else if (inputValue.trim()) addNew()
    } else if (e.key === "Escape") setShowSuggestions(false)
    else if (e.key === "Backspace" && !inputValue && value.length > 0) remove(value[value.length - 1].name)
  }

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-1.5 min-h-[2.5rem] rounded-md border border-input bg-background px-2 py-1.5 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((org) => (
          <Badge key={org.name} variant="secondary" className="gap-1 pr-1">
            {org.name}
            {org.id === null && <span className="text-xs text-muted-foreground">(yeni)</span>}
            <button type="button" onClick={() => remove(org.name)} className="rounded-full hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[160px]">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? "Kurum / şirket ara veya ekle..." : ""}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {showSuggestions && inputValue && (
            <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border bg-popover shadow-md">
              {filtered.length > 0 && (
                <ul className="py-1">
                  {filtered.map((s) => (
                    <li
                      key={s.id}
                      onMouseDown={() => add({ id: s.id, name: s.name })}
                      className="flex items-center justify-between cursor-pointer px-3 py-1.5 text-sm hover:bg-accent"
                    >
                      <span>{s.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{s.article_count}</span>
                    </li>
                  ))}
                </ul>
              )}
              {inputValue.trim() && !selectedNames.has(inputValue.trim().toLowerCase()) && (
                <div
                  onMouseDown={addNew}
                  className="flex items-center gap-1 cursor-pointer px-3 py-1.5 text-sm text-primary hover:bg-accent border-t"
                >
                  <Plus className="h-3 w-3" />
                  <span>&ldquo;{inputValue.trim()}&rdquo; oluştur</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {inputValue.trim() && (
        <p className="text-xs text-muted-foreground">Enter ile ekle · yeni kurum otomatik oluşturulur</p>
      )}
    </div>
  )
}
