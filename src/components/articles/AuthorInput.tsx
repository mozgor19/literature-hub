"use client"

import { useState, useRef } from "react"
import { X, Plus } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import type { AuthorWithCount } from "@/types/database"

export interface SelectedAuthor {
  id: string | null  // null = new author not yet in DB
  name: string
}

interface AuthorInputProps {
  value: SelectedAuthor[]
  onChange: (authors: SelectedAuthor[]) => void
}

export function AuthorInput({ value, onChange }: AuthorInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: suggestions = [] } = useQuery<AuthorWithCount[]>({
    queryKey: ["authors", inputValue],
    queryFn: () =>
      fetch(`/api/authors?q=${encodeURIComponent(inputValue)}`).then((r) => r.json()),
    enabled: inputValue.length > 0,
  })

  const selectedNames = new Set(value.map((a) => a.name.toLowerCase()))

  const filteredSuggestions = suggestions.filter(
    (s) => !selectedNames.has(s.name.toLowerCase())
  )

  const add = (author: SelectedAuthor) => {
    if (!selectedNames.has(author.name.toLowerCase())) {
      onChange([...value, author])
    }
    setInputValue("")
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const addNew = () => {
    const name = inputValue.trim()
    if (!name || selectedNames.has(name.toLowerCase())) return
    add({ id: null, name })
  }

  const remove = (name: string) => {
    onChange(value.filter((a) => a.name.toLowerCase() !== name.toLowerCase()))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (filteredSuggestions.length > 0 && inputValue) {
        add({ id: filteredSuggestions[0].id, name: filteredSuggestions[0].name })
      } else if (inputValue.trim()) {
        addNew()
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      remove(value[value.length - 1].name)
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-1.5 min-h-[2.5rem] rounded-md border border-input bg-background px-2 py-1.5 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((author) => (
          <Badge key={author.name} variant="secondary" className="gap-1 pr-1">
            {author.name}
            {author.id === null && <span className="text-xs text-muted-foreground">(yeni)</span>}
            <button
              type="button"
              onClick={() => remove(author.name)}
              className="rounded-full hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[140px]">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? "Yazar ara veya ekle..." : ""}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {showSuggestions && inputValue && (
            <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border bg-popover shadow-md">
              {filteredSuggestions.length > 0 && (
                <ul className="py-1">
                  {filteredSuggestions.map((s) => (
                    <li
                      key={s.id}
                      onMouseDown={() => add({ id: s.id, name: s.name })}
                      className="cursor-pointer px-3 py-1.5 text-sm hover:bg-accent flex items-center justify-between"
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
        <p className="text-xs text-muted-foreground">
          Enter ile ekle · yeni yazar otomatik oluşturulur
        </p>
      )}
    </div>
  )
}

// Parse a free-text authors string into SelectedAuthor[] (used when metadata is auto-filled)
export function parseAuthorsText(text: string): SelectedAuthor[] {
  if (!text.trim()) return []
  let raw = text
  raw = raw.replace(/\s*,?\s*et\s+al\.?\s*$/i, "")
  raw = raw.replace(/\s+(and|ve|&)\s+/gi, ", ")
  raw = raw.replace(/\s*;\s*/g, ", ")
  return raw
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .map((name) => ({ id: null, name }))
}
