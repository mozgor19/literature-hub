"use client"

import { useState, useRef } from "react"
import { X, Plus } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DBTag } from "@/types/database"

interface SelectedTag {
  id: string | null  // null = new tag not yet in DB
  name: string
}

interface TagInputProps {
  value: SelectedTag[]
  onChange: (tags: SelectedTag[]) => void
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: suggestions = [] } = useQuery<DBTag[]>({
    queryKey: ["tags", inputValue],
    queryFn: () =>
      fetch(`/api/tags?q=${encodeURIComponent(inputValue)}`).then((r) => r.json()),
    enabled: inputValue.length > 0,
  })

  const selectedNames = new Set(value.map((t) => t.name.toLowerCase()))

  const filteredSuggestions = suggestions.filter(
    (s) => !selectedNames.has(s.name.toLowerCase())
  )

  const addTag = (tag: SelectedTag) => {
    if (!selectedNames.has(tag.name.toLowerCase())) {
      onChange([...value, tag])
    }
    setInputValue("")
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const addNewTag = () => {
    const name = inputValue.trim()
    if (!name || selectedNames.has(name.toLowerCase())) return
    addTag({ id: null, name })
  }

  const removeTag = (name: string) => {
    onChange(value.filter((t) => t.name.toLowerCase() !== name.toLowerCase()))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (filteredSuggestions.length > 0 && inputValue) {
        addTag({ id: filteredSuggestions[0].id, name: filteredSuggestions[0].name })
      } else if (inputValue.trim()) {
        addNewTag()
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1].name)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[2.5rem] rounded-md border border-input bg-background px-2 py-1.5 cursor-text" onClick={() => inputRef.current?.focus()}>
        {value.map((tag) => (
          <Badge key={tag.name} variant="secondary" className="gap-1 pr-1">
            {tag.name}
            {tag.id === null && <span className="text-xs text-muted-foreground">(yeni)</span>}
            <button type="button" onClick={() => removeTag(tag.name)} className="rounded-full hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[120px]">
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
            placeholder={value.length === 0 ? "Etiket ara veya ekle..." : ""}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {showSuggestions && inputValue && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border bg-popover shadow-md">
              {filteredSuggestions.length > 0 && (
                <ul className="py-1">
                  {filteredSuggestions.map((s) => (
                    <li
                      key={s.id}
                      onMouseDown={() => addTag({ id: s.id, name: s.name })}
                      className="cursor-pointer px-3 py-1.5 text-sm hover:bg-accent"
                    >
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
              {inputValue.trim() && !selectedNames.has(inputValue.trim().toLowerCase()) && (
                <div
                  onMouseDown={addNewTag}
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
          Enter ile ekle · yeni etiket otomatik oluşturulur
        </p>
      )}
    </div>
  )
}
