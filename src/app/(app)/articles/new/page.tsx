import { AddArticleForm } from "@/components/articles/AddArticleForm"

export const metadata = { title: "Makale Ekle – Literature Hub" }

export default function NewArticlePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Makale Ekle</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Yeni makaleyi PDF ile birlikte havuza ekleyin
        </p>
      </div>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <AddArticleForm />
      </div>
    </div>
  )
}
