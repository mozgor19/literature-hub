"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Upload, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { TagInput } from "./TagInput"
import type { FieldWithChildren } from "@/types/database"

interface SelectedTag {
  id: string | null
  name: string
}

export function AddArticleForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [title, setTitle] = useState("")
  const [authors, setAuthors] = useState("")
  const [year, setYear] = useState("")
  const [abstract, setAbstract] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedTopFieldId, setSelectedTopFieldId] = useState("")
  const [selectedSubFieldId, setSelectedSubFieldId] = useState("")
  const [tags, setTags] = useState<SelectedTag[]>([])
  const [file, setFile] = useState<File | null>(null)

  // Inline field creation
  const [showNewFieldDialog, setShowNewFieldDialog] = useState(false)
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldParentId, setNewFieldParentId] = useState<string | null>(null)
  const [creatingField, setCreatingField] = useState(false)

  const { data: fields = [], refetch: refetchFields } = useQuery<FieldWithChildren[]>({
    queryKey: ["fields"],
    queryFn: () => fetch("/api/fields").then((r) => r.json()),
  })

  const selectedTopField = fields.find((f) => f.id === selectedTopFieldId)
  const subfields = selectedTopField?.children ?? []

  // The effective field_id for the article: subfield if chosen, else top field
  const effectiveFieldId = selectedSubFieldId || selectedTopFieldId

  const handleCreateField = async () => {
    if (!newFieldName.trim()) return
    setCreatingField(true)
    try {
      const res = await fetch("/api/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFieldName.trim(), parent_id: newFieldParentId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      const newField = await res.json()
      await refetchFields()

      // Auto-select the new field
      if (newFieldParentId) {
        setSelectedSubFieldId(newField.id)
      } else {
        setSelectedTopFieldId(newField.id)
        setSelectedSubFieldId("")
      }
      setShowNewFieldDialog(false)
      setNewFieldName("")
      toast.success(`"${newField.name}" alanı oluşturuldu`)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setCreatingField(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !authors.trim()) {
      toast.error("Başlık ve yazarlar zorunludur")
      return
    }
    if (!effectiveFieldId) {
      toast.error("Lütfen bir alan seçin")
      return
    }
    if (!file) {
      toast.error("PDF dosyası zorunludur")
      return
    }

    setSubmitting(true)

    const existingTagIds = tags.filter((t) => t.id !== null).map((t) => t.id as string)
    const newTagNames = tags.filter((t) => t.id === null).map((t) => t.name)

    const formData = new FormData()
    formData.append("title", title.trim())
    formData.append("authors", authors.trim())
    if (year) formData.append("year", year)
    if (abstract.trim()) formData.append("abstract", abstract.trim())
    if (sourceUrl.trim()) formData.append("source_url", sourceUrl.trim())
    if (notes.trim()) formData.append("notes", notes.trim())
    formData.append("field_id", effectiveFieldId)
    formData.append("tag_ids", JSON.stringify(existingTagIds))
    formData.append("new_tags", JSON.stringify(newTagNames))
    formData.append("file", file)

    try {
      const res = await fetch("/api/articles", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Makale eklenemedi")
      toast.success("Makale başarıyla eklendi")
      router.push("/")
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic metadata */}
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Başlık <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Makalenin tam başlığı"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authors">
              Yazarlar <span className="text-destructive">*</span>
            </Label>
            <Input
              id="authors"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="Smith J., Doe A., ..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Yıl</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
                min={1900}
                max={new Date().getFullYear() + 1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source_url">Kaynak URL</Label>
              <Input
                id="source_url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://doi.org/..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="abstract">Özet</Label>
            <Textarea
              id="abstract"
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Makale özeti..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notlar</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kişisel notlar..."
              rows={2}
            />
          </div>
        </div>

        <Separator />

        {/* Field selection */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">
            Alan Seçimi <span className="text-destructive">*</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ana Alan</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedTopFieldId}
                  onValueChange={(v) => {
                    setSelectedTopFieldId(v)
                    setSelectedSubFieldId("")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Alan seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setNewFieldParentId(null)
                    setShowNewFieldDialog(true)
                  }}
                  title="Yeni ana alan oluştur"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedTopFieldId && (
              <div className="space-y-2">
                <Label>Alt Alan (isteğe bağlı)</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedSubFieldId}
                    onValueChange={setSelectedSubFieldId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Alt alan seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {subfields.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setNewFieldParentId(selectedTopFieldId)
                      setShowNewFieldDialog(true)
                    }}
                    title="Yeni alt alan oluştur"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {effectiveFieldId && selectedTopField && (
            <p className="text-xs text-muted-foreground">
              Klasör:{" "}
              <span className="font-medium text-foreground">
                {selectedSubFieldId
                  ? `${selectedTopField.name} / ${subfields.find((f) => f.id === selectedSubFieldId)?.name}`
                  : selectedTopField.name}
              </span>
            </p>
          )}
        </div>

        <Separator />

        {/* Tags */}
        <div className="space-y-2">
          <Label>Etiketler</Label>
          <TagInput value={tags} onChange={setTags} />
        </div>

        <Separator />

        {/* File upload */}
        <div className="space-y-2">
          <Label>
            PDF Dosyası <span className="text-destructive">*</span>
          </Label>
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center w-full h-32 rounded-md border-2 border-dashed border-input bg-background cursor-pointer hover:bg-accent/50 transition-colors"
          >
            {file ? (
              <div className="text-center">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
                <p className="text-xs text-primary mt-1">Değiştirmek için tıklayın</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <p className="text-sm">PDF dosyası seçin veya sürükleyin</p>
                <p className="text-xs">Maks. boyut: ~10 MB</p>
              </div>
            )}
            <input
              id="file-upload"
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            İptal
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Yükleniyor..." : "Makale Ekle"}
          </Button>
        </div>
      </form>

      {/* Inline field creation dialog */}
      <Dialog open={showNewFieldDialog} onOpenChange={setShowNewFieldDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {newFieldParentId ? "Yeni Alt Alan Oluştur" : "Yeni Ana Alan Oluştur"}
            </DialogTitle>
          </DialogHeader>
          {newFieldParentId && (
            <p className="text-sm text-muted-foreground">
              Üst alan:{" "}
              <span className="font-medium text-foreground">
                {fields.find((f) => f.id === newFieldParentId)?.name}
              </span>
            </p>
          )}
          <Input
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="Alan adı..."
            onKeyDown={(e) => e.key === "Enter" && handleCreateField()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFieldDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateField} disabled={creatingField || !newFieldName.trim()}>
              {creatingField && <Loader2 className="h-4 w-4 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
