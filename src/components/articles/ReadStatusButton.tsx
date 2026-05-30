"use client"

import { useState, useTransition } from "react"
import type { ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { BookOpen, BookCheck, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { toast } from "sonner"
import type { ReadStatus } from "@/types/database"

interface Props {
  articleId: string
  initialStatus: ReadStatus
}

const CYCLE: ReadStatus[] = ["unread", "reading", "read"]

const CONFIG: Record<ReadStatus, { icon: ReactNode; label: string; cls: string }> = {
  unread: {
    icon: <BookOpen className="h-3.5 w-3.5" />,
    label: "Okunmadı",
    cls: "text-muted-foreground",
  },
  reading: {
    icon: <Eye className="h-3.5 w-3.5" />,
    label: "Okunuyor",
    cls: "text-amber-500",
  },
  read: {
    icon: <BookCheck className="h-3.5 w-3.5" />,
    label: "Okundu",
    cls: "text-green-600",
  },
}

export function ReadStatusButton({ articleId, initialStatus }: Props) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ReadStatus>(initialStatus)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    const next = CYCLE[(CYCLE.indexOf(status) + 1) % CYCLE.length]

    // Optimistic update
    setStatus(next)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/articles/${articleId}/read-status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        })
        if (!res.ok) throw new Error()
        await queryClient.invalidateQueries({ queryKey: ["articles"] })
      } catch {
        // Revert on failure
        setStatus(status)
        toast.error("Okuma durumu güncellenemedi")
      }
    })
  }

  const cfg = CONFIG[status]

  return (
    <Tooltip content={`${cfg.label} — durumu değiştir`}>
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${cfg.cls}`}
        onClick={handleClick}
        disabled={isPending}
        aria-label={cfg.label}
      >
        {cfg.icon}
      </Button>
    </Tooltip>
  )
}
