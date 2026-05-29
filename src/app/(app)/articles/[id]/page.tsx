import { Suspense } from "react"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CommentSection } from "@/components/comments/CommentSection"
import { ArrowLeft, ExternalLink, Calendar, User, FolderOpen } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data } = await supabase.from("articles").select("title").eq("id", id).single()
  return { title: data ? `${data.title} – Literature Hub` : "Makale – Literature Hub" }
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([auth(), params])

  const { data: article, error } = await supabase
    .from("articles")
    .select(`
      id, title, authors, year, abstract, source_url, notes,
      drive_web_link, drive_folder_path, added_at,
      field:fields!field_id(id, name, parent_id),
      article_tags(tags(id, name)),
      added_by_user:users!added_by(id, name, email)
    `)
    .eq("id", id)
    .single()

  if (error || !article) notFound()

  const tags = (article.article_tags ?? []).map((at: { tags: unknown }) => at.tags).filter(Boolean) as Array<{ id: string; name: string }>
  const field = article.field as { name: string; parent_id: string | null } | null
  const addedBy = article.added_by_user as { name: string | null; email: string } | null

  // Resolve parent field name
  let parentFieldName: string | null = null
  if (field?.parent_id) {
    const { data: pf } = await supabase.from("fields").select("name").eq("id", field.parent_id).single()
    parentFieldName = pf?.name ?? null
  }
  const fieldPath = parentFieldName ? `${parentFieldName} / ${field?.name}` : field?.name ?? "—"

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back */}
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href="/articles">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Makale Listesi
        </Link>
      </Button>

      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold leading-snug">{article.title}</h1>
        <p className="text-muted-foreground">{article.authors}</p>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {article.year && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {article.year}
            </span>
          )}
          <span className="flex items-center gap-1">
            <FolderOpen className="h-3.5 w-3.5" />
            {fieldPath}
          </span>
          {addedBy && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {addedBy.name ?? addedBy.email} · {formatDate(article.added_at)}
            </span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1 w-full">
          <Button asChild size="sm">
            <a href={article.drive_web_link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Drive'da Aç
            </a>
          </Button>
          {article.source_url && (
            <Button asChild size="sm" variant="outline">
              <a href={article.source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Kaynak
              </a>
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Abstract */}
      {article.abstract && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Özet</h2>
          <p className="text-sm leading-relaxed text-foreground">{article.abstract}</p>
        </section>
      )}

      {/* Notes */}
      {article.notes && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notlar</h2>
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{article.notes}</p>
        </section>
      )}

      <Separator />

      {/* Comments */}
      <Suspense fallback={<div className="text-sm text-muted-foreground">Tartışma yükleniyor…</div>}>
        <CommentSection
          articleId={article.id}
          currentUserId={session?.user.id ?? null}
          isCurrentUserAdmin={session?.user.isAdmin ?? false}
        />
      </Suspense>
    </div>
  )
}
