"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Upload, Plus, Loader2, Sparkles, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { TagInput } from "./TagInput"
import { AuthorInput, parseAuthorsText } from "./AuthorInput"
import type { FieldWithChildren } from "@/types/database"
import type { SelectedAuthor } from "./AuthorInput"

// Flatten a recursive field tree into a list with readable path labels
function flattenFields(
  fields: FieldWithChildren[],
  depth = 0
): Array<{ id: string; label: string }> {
  return fields.flatMap((f) => [
    { id: f.id, label: " ".repeat(depth * 4) + (depth > 0 ? "↳ " : "") + f.name },
    ...flattenFields(f.children, depth + 1),
  ])
}

interface SelectedTag {
  id: string | null
  name: string
}

type MetadataFieldSource = "embedded" | "heuristic" | "crossref" | "crossref-title" | "arxiv"

interface HeuristicResponse {
  title: string | null
  authors: string | null
  year: number | null
  abstract: string | null
  tags: string[]
  doi: string | null
  arxivId: string | null
  fieldSources: Partial<Record<string, "embedded" | "heuristic">>
}

interface LookupResponse {
  title: string | null
  authors: string | null
  year: number | null
  abstract: string | null
  tags: string[]
  sourceUrl: string | null
  doi: string | null
  journal: string | null
  lookupSource: "crossref" | "crossref-title" | "arxiv"
  fieldSources: Partial<Record<string, "crossref" | "crossref-title" | "arxiv">>
}

// Small badge shown next to labels for auto-filled fields
function SourceBadge({ source }: { source: MetadataFieldSource | undefined }) {
  if (!source) return null
  const cfg: Record<MetadataFieldSource, { label: string; cls: string }> = {
    embedded:       { label: "PDF",      cls: "bg-slate-100 text-slate-600" },
    heuristic:      { label: "PDF",      cls: "bg-slate-100 text-slate-600" },
    crossref:       { label: "Crossref", cls: "bg-blue-100 text-blue-700" },
    "crossref-title": { label: "Crossref", cls: "bg-blue-100 text-blue-700" },
    arxiv:          { label: "arXiv",    cls: "bg-green-100 text-green-700" },
  }
  const { label, cls } = cfg[source]
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ml-1.5 ${cls}`}>{label}</span>
}

interface ManualOverrides {
  title: boolean
  authors: boolean
  year: boolean
  abstract: boolean
  sourceUrl: boolean
  tags: boolean
}

const VERCEL_SAFE_PDF_LIMIT_MB = 4.5

export function AddArticleForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [title, setTitle] = useState("")
  const [authorList, setAuthorList] = useState<SelectedAuthor[]>([])
  const [year, setYear] = useState("")
  const [abstract, setAbstract] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedFieldId, setSelectedFieldId] = useState("")
  const [tags, setTags] = useState<SelectedTag[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [extractingMetadata, setExtractingMetadata] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [extractionSummary, setExtractionSummary] = useState<string | null>(null)
  const [fieldSources, setFieldSources] = useState<Partial<Record<string, MetadataFieldSource>>>({})
  const [detectedDoi, setDetectedDoi] = useState<string | null>(null)
  const [detectedArxivId, setDetectedArxivId] = useState<string | null>(null)
  const [, setManualOverrides] = useState<ManualOverrides>({
    title: false,
    authors: false,
    year: false,
    abstract: false,
    sourceUrl: false,
    tags: false,
  })
  const manualOverridesRef = useRef<ManualOverrides>({
    title: false,
    authors: false,
    year: false,
    abstract: false,
    sourceUrl: false,
    tags: false,
  })

  // Inline field creation
  const [showNewFieldDialog, setShowNewFieldDialog] = useState(false)
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldParentId, setNewFieldParentId] = useState<string | null>(null)
  const [creatingField, setCreatingField] = useState(false)

  const { data: fields = [], refetch: refetchFields } = useQuery<FieldWithChildren[]>({
    queryKey: ["fields"],
    queryFn: () => fetch("/api/fields").then((r) => r.json()),
  })

  const flatFields = flattenFields(fields)
  const fileSizeMb = file ? file.size / 1024 / 1024 : 0
  const exceedsVercelSafeLimit = fileSizeMb > VERCEL_SAFE_PDF_LIMIT_MB

  const markManualOverride = (field: keyof ManualOverrides) => {
    setManualOverrides((current) => {
      const next = { ...current, [field]: true }
      manualOverridesRef.current = next
      return next
    })
  }

  const resetManualOverrides = () => {
    const next = {
      title: false,
      authors: false,
      year: false,
      abstract: false,
      sourceUrl: false,
      tags: false,
    }
    manualOverridesRef.current = next
    setManualOverrides(next)
  }

  // Apply metadata from either heuristic or lookup phase, respecting manual overrides.
  const applyMetadata = (
    data: { title?: string | null; authors?: string | null; year?: number | null; abstract?: string | null; tags?: string[] },
    sources: Partial<Record<string, MetadataFieldSource>>,
    sourceUrl?: string | null
  ) => {
    const ov = manualOverridesRef.current
    if (!ov.title && data.title) setTitle(data.title)
    if (!ov.authors && data.authors) setAuthorList(parseAuthorsText(data.authors))
    if (!ov.year && data.year) setYear(String(data.year))
    if (!ov.abstract && data.abstract) setAbstract(data.abstract)
    if (!ov.sourceUrl && sourceUrl) setSourceUrl(sourceUrl)
    if (!ov.tags && data.tags?.length) setTags(data.tags.map(t => ({ id: null, name: t })))

    setFieldSources(prev => ({ ...prev, ...sources }))
  }

  // Trigger the remote lookup phase (Crossref / arXiv) — non-blocking.
  const triggerLookup = async (
    doi: string | null,
    arxivId: string | null,
    titleHint: string | null
  ) => {
    setLookingUp(true)
    try {
      const params = new URLSearchParams()
      if (doi) params.set("doi", doi)
      else if (arxivId) params.set("arxiv", arxivId)
      else if (titleHint) params.set("title", titleHint)
      else return

      const res = await fetch(`/api/articles/lookup?${params}`)
      if (res.status === 204) return // nothing found

      if (!res.ok) return
      const data = await res.json() as LookupResponse

      applyMetadata(data, data.fieldSources, data.sourceUrl ?? undefined)

      const src = data.lookupSource === "arxiv" ? "arXiv" : "Crossref"
      const filled = [
        data.title && "başlık", data.authors && "yazarlar",
        data.year && "yıl", data.abstract && "özet",
        data.tags?.length && "etiketler",
      ].filter(Boolean)
      if (filled.length) {
        setExtractionSummary(
          `${src} üzerinden ${filled.join(", ")} için doğrulanmış öneriler getirildi. Kaydetmeden önce kontrol edin.`
        )
      }
    } catch {
      // Silently ignore lookup errors — heuristic values remain
    } finally {
      setLookingUp(false)
    }
  }

  const handleFileChange = async (nextFile: File | null) => {
    setFile(nextFile)
    setExtractionSummary(null)
    setFieldSources({})
    setDetectedDoi(null)
    setDetectedArxivId(null)
    resetManualOverrides()

    if (!nextFile) return

    if (nextFile.size / 1024 / 1024 > VERCEL_SAFE_PDF_LIMIT_MB) {
      toast.warning(
        `Bu PDF ${VERCEL_SAFE_PDF_LIMIT_MB} MB üzeri. Vercel deployunda yükleme başarısız olabilir.`
      )
    }

    // ── Phase 1: fast heuristic parse (no network calls) ───────────────────
    setExtractingMetadata(true)
    let heuristic: HeuristicResponse | null = null
    try {
      const fd = new FormData()
      fd.append("file", nextFile)
      const res = await fetch("/api/articles/extract", { method: "POST", body: fd })
      if (res.ok) heuristic = await res.json() as HeuristicResponse
    } catch {
      // ignore
    } finally {
      setExtractingMetadata(false)
    }

    if (heuristic) {
      applyMetadata(heuristic, heuristic.fieldSources)
      setDetectedDoi(heuristic.doi ?? null)
      setDetectedArxivId(heuristic.arxivId ?? null)

      const populated = [
        heuristic.title && "başlık", heuristic.authors && "yazarlar",
        heuristic.year && "yıl", heuristic.abstract && "özet",
        heuristic.tags.length && "etiketler",
      ].filter(Boolean)
      setExtractionSummary(
        populated.length
          ? `PDF'ten ${populated.join(", ")} için öneriler getirildi. ${heuristic.doi || heuristic.arxivId ? "Kaynak aranıyor…" : "Kaydetmeden önce kontrol edin."}`
          : "PDF okundu. Güçlü bir metadata bulunamadı, alanları elle doldurun."
      )
    } else {
      setExtractionSummary("PDF yüklendi. Bilgiler otomatik getirilemedi.")
    }

    // ── Phase 2: remote lookup — runs concurrently, updates form when ready ─
    void triggerLookup(
      heuristic?.doi ?? null,
      heuristic?.arxivId ?? null,
      heuristic?.title ?? null
    )
  }

  // Re-fetch button: re-run lookup with current DOI/arXiv/title
  const handleRefetchMetadata = () => {
    void triggerLookup(detectedDoi, detectedArxivId, title || null)
  }

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

      setSelectedFieldId(newField.id)
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

    if (!title.trim()) {
      toast.error("Başlık zorunludur")
      return
    }
    if (authorList.length === 0) {
      toast.error("En az bir yazar ekleyin")
      return
    }
    if (!selectedFieldId) {
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
    const existingAuthorIds = authorList.filter((a) => a.id !== null).map((a) => a.id as string)
    const newAuthorNames = authorList.filter((a) => a.id === null).map((a) => a.name)

    const formData = new FormData()
    formData.append("title", title.trim())
    if (year) formData.append("year", year)
    if (abstract.trim()) formData.append("abstract", abstract.trim())
    if (sourceUrl.trim()) formData.append("source_url", sourceUrl.trim())
    if (notes.trim()) formData.append("notes", notes.trim())
    formData.append("field_id", selectedFieldId)
    formData.append("tag_ids", JSON.stringify(existingTagIds))
    formData.append("new_tags", JSON.stringify(newTagNames))
    formData.append("author_ids", JSON.stringify(existingAuthorIds))
    formData.append("new_authors", JSON.stringify(newAuthorNames))
    formData.append("file", file)

    try {
      const res = await fetch("/api/articles", { method: "POST", body: formData })
      const raw = await res.text()
      let data: { error?: string } | null = null

      if (raw) {
        try {
          data = JSON.parse(raw) as { error?: string }
        } catch {
          throw new Error("Sunucu geçerli bir JSON cevabı dönmedi")
        }
      }

      if (!res.ok) throw new Error(data?.error ?? "Makale eklenemedi")
      toast.success("Makale başarıyla eklendi")
      router.push("/")
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Makale eklenirken beklenmeyen bir hata oluştu"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic metadata */}
        <div className="grid gap-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium text-slate-900">
                  PDF yüklendiğinde başlık, yazarlar, özet, yıl ve etiketler için otomatik öneriler gelir.
                </p>
                <p className="text-muted-foreground">
                  Bu öneriler yardımcı amaçlıdır. Kaydetmeden önce doğruluğunu kontrol etmeniz gerekir.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor="title">Başlık <span className="text-destructive">*</span></Label>
              <SourceBadge source={fieldSources.title as MetadataFieldSource | undefined} />
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                markManualOverride("title")
              }}
              placeholder="Makalenin tam başlığı"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center">
              <Label>Yazarlar <span className="text-destructive">*</span></Label>
              <SourceBadge source={fieldSources.authors as MetadataFieldSource | undefined} />
            </div>
            <AuthorInput
              value={authorList}
              onChange={(next) => {
                setAuthorList(next)
                markManualOverride("authors")
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <Label htmlFor="year">Yıl</Label>
                <SourceBadge source={fieldSources.year as MetadataFieldSource | undefined} />
              </div>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => {
                  setYear(e.target.value)
                  markManualOverride("year")
                }}
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
                onChange={(e) => {
                  setSourceUrl(e.target.value)
                  markManualOverride("sourceUrl")
                }}
                placeholder="https://doi.org/..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center">
              <Label htmlFor="abstract">Özet</Label>
              <SourceBadge source={fieldSources.abstract as MetadataFieldSource | undefined} />
            </div>
            <Textarea
              id="abstract"
              value={abstract}
              onChange={(e) => {
                setAbstract(e.target.value)
                markManualOverride("abstract")
              }}
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
        <div className="space-y-3">
          <h3 className="font-medium text-sm">
            Alan Seçimi <span className="text-destructive">*</span>
          </h3>
          <div className="flex gap-2">
            <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Alan seçin..." />
              </SelectTrigger>
              <SelectContent>
                {flatFields.map(({ id, label }) => (
                  <SelectItem key={id} value={id} className="font-mono text-sm">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                setNewFieldParentId(selectedFieldId || null)
                setShowNewFieldDialog(true)
              }}
              title={selectedFieldId ? "Seçili alanın altına yeni alan ekle" : "Yeni ana alan oluştur"}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Tags */}
        <div className="space-y-2">
          <Label>Etiketler</Label>
          <TagInput
            value={tags}
            onChange={(nextTags) => {
              setTags(nextTags)
              markManualOverride("tags")
            }}
          />
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
                <p className="text-xs">Vercel deployunda önerilen üst sınır: {VERCEL_SAFE_PDF_LIMIT_MB} MB</p>
              </div>
            )}
            <input
              id="file-upload"
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="min-h-5 space-y-1">
            {extractingMetadata && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                PDF okunuyor…
              </p>
            )}
            {lookingUp && !extractingMetadata && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Crossref / arXiv üzerinde aranıyor…
              </p>
            )}
            {!extractingMetadata && !lookingUp && extractionSummary && (
              <div className="flex items-start gap-2">
                <p className="flex-1 text-xs text-muted-foreground">{extractionSummary}</p>
                {file && (
                  <button
                    type="button"
                    onClick={handleRefetchMetadata}
                    className="flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                    title="Metadata'yı yeniden ara"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Yeniden ara
                  </button>
                )}
              </div>
            )}
          </div>
          {file && exceedsVercelSafeLimit && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Bu dosya yaklaşık {fileSizeMb.toFixed(1)} MB. Vercel üzerindeki yükleme limitleri nedeniyle
              başarısız olabilir. Mümkünse daha küçük bir PDF kullanın; alternatif olarak şimdilik kaynak
              URL bilgisini girip belgeyi daha sonra ekleyin.
            </div>
          )}
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
                {flatFields.find((f) => f.id === newFieldParentId)?.label.trim()}
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
