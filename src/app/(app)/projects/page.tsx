import { Suspense } from "react"
import { ProjectList } from "@/components/projects/ProjectList"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Projeler – Literature Hub" }

export default function ProjectsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Projeler</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Makale koleksiyonları — havuzdan referans ekler, kopyalamaz
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ProjectList />
      </Suspense>
    </div>
  )
}
