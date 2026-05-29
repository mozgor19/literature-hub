"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { BookText, Mail, UserCircle2 } from "lucide-react"
import { ArticleTable } from "@/components/articles/ArticleTable"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ArticleWithRelations } from "@/types/database"

interface ArticlesResponse {
  articles: ArticleWithRelations[]
  total: number
  page: number
  limit: number
}

export function ProfilePage() {
  const { data: session } = useSession()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<ArticlesResponse>({
    queryKey: ["articles", "mine", page],
    queryFn: async () => {
      const res = await fetch(`/api/articles?mine=1&page=${page}`)
      if (!res.ok) throw new Error("Makaleler yüklenemedi")
      return res.json()
    },
  })

  if (!session?.user) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Profil bilgileri yüklenemedi.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              className="h-16 w-16 rounded-full border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserCircle2 className="h-9 w-9" />
            </div>
          )}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {session.user.name ?? "Profilim"}
            </h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              {session.user.email}
            </p>
          </div>
        </div>

        <Card className="min-w-44 border-dashed">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <BookText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Yüklediğim Makaleler
              </p>
              <p className="text-2xl font-semibold">
                {isLoading ? "..." : data?.total ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Yüklediğim Makaleler</h2>
            <p className="text-sm text-muted-foreground">
              Hesabınızla eklediğiniz tüm makaleleri burada görebilirsiniz.
            </p>
          </div>
          <Link href="/articles/new" className="text-sm font-medium text-primary hover:underline">
            Yeni makale ekle
          </Link>
        </div>

        {isLoading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <ArticleTable
            articles={data?.articles ?? []}
            isLoading={isLoading}
            total={data?.total ?? 0}
            page={page}
            limit={data?.limit ?? 25}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}

