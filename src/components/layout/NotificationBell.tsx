"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { NotificationWithDetails } from "@/types/database"

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "az önce"
  if (diff < 3600) return `${Math.floor(diff / 60)}d önce`
  if (diff < 86400) return `${Math.floor(diff / 3600)}s önce`
  return `${Math.floor(diff / 86400)}g önce`
}

function notificationText(n: NotificationWithDetails): string {
  const actor = (n.actor as { name: string | null; email: string } | null)
  const name = actor?.name ?? actor?.email ?? "Biri"
  if (n.type === "reply_to_comment") return `${name} yorumunuza yanıt verdi`
  return `${name} makalenize yorum yaptı`
}

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationWithDetails[]>([])
  const [open, setOpen] = useState(false)

  const unread = notifications.filter((n) => !n.is_read).length

  const fetchNotifications = async () => {
    const res = await fetch("/api/notifications")
    if (res.ok) setNotifications(await res.json())
  }

  useEffect(() => {
    queueMicrotask(() => {
      void fetchNotifications()
    })
    const id = setInterval(() => {
      void fetchNotifications()
    }, 30_000)
    const onFocus = () => {
      void fetchNotifications()
    }
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" })
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && unread > 0) markAllRead()
  }

  const handleClick = (n: NotificationWithDetails) => {
    setOpen(false)
    const article = n.article as { id: string } | null
    if (!article?.id) return
    const hash = n.comment_id ? `#comment-${n.comment_id}` : ""
    router.push(`/articles/${article.id}${hash}`)
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Bildirimler</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Henüz bildirim yok
          </div>
        ) : (
          notifications.map((n) => {
            const article = n.article as { id: string; title: string } | null
            return (
              <DropdownMenuItem
                key={n.id}
                className={cn(
                  "flex flex-col items-start gap-0.5 cursor-pointer py-3",
                  !n.is_read && "bg-primary/5"
                )}
                onClick={() => handleClick(n)}
              >
                <span className="text-sm leading-snug">{notificationText(n)}</span>
                {article && (
                  <span className="text-xs text-muted-foreground truncate max-w-full">
                    {article.title}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
