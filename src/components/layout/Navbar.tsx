"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import { BookOpen, BookText, FolderTree, LogOut, FolderOpen, ChevronDown, User, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/components/layout/NotificationBell"

const navLinks = [
  { href: "/articles", label: "Makaleler", icon: BookText },
  { href: "/fields", label: "Alanlar", icon: FolderTree },
  { href: "/projects", label: "Projeler", icon: FolderOpen },
]

export function Navbar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold shrink-0">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Literature Hub</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 ml-2">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 sm:px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Add article button */}
          <Button asChild size="sm">
            <Link href="/articles/new">
              <span className="sm:hidden">+</span>
              <span className="hidden sm:inline">+ Makale Ekle</span>
            </Link>
          </Button>

          {/* Notification bell */}
          {session?.user && <NotificationBell />}

          {/* User menu */}
          {session?.user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? ""}
                      className="h-6 w-6 rounded-full"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      {session.user.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <span className="hidden sm:inline text-sm">{session.user.name}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  {session.user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {session.user.isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/duplicates" className="cursor-pointer">
                      <ShieldAlert className="h-4 w-4 mr-2" />
                      Olası Tekrarlar
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    Profilim
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/signin" })}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
