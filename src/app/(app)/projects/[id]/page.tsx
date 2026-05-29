import { Suspense } from "react"
import { ProjectDetail } from "@/components/projects/ProjectDetail"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Proje – Literature Hub" }

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ProjectDetail id={id} />
    </Suspense>
  )
}
