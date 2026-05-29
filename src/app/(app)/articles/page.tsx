import { Suspense } from "react"
import { ArticleBrowser } from "@/components/articles/ArticleBrowser"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Makaleler – Literature Hub" }

export default function ArticlesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Makale Havuzu</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Araştırma grubunun tüm makaleleri
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex gap-6">
            <Skeleton className="h-96 w-64 shrink-0" />
            <div className="flex-1 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </div>
        }
      >
        <ArticleBrowser />
      </Suspense>
    </div>
  )
}
