"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { truncate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface DeleteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  redirectToProjects?: boolean
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  redirectToProjects = false,
}: DeleteProjectDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [deleting, setDeleting] = useState(false)

  const closeDialog = (nextOpen: boolean) => {
    if (!nextOpen && deleting) return
    if (!nextOpen) setStep(1)
    onOpenChange(nextOpen)
  }

  const handleDelete = async () => {
    setDeleting(true)

    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
      const raw = await res.text()
      const data = raw ? JSON.parse(raw) as { error?: string } : null

      if (!res.ok) {
        throw new Error(data?.error ?? "Proje silinemedi")
      }

      await queryClient.invalidateQueries({ queryKey: ["projects"] })
      await queryClient.invalidateQueries({ queryKey: ["project"] })
      toast.success("Proje silindi")
      closeDialog(false)

      if (redirectToProjects) {
        router.push("/projects")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Proje silinemedi"
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Projeyi sil?" : "Son onay"}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? `"${truncate(projectName, 80)}" projesini silmek üzeresiniz.`
              : "Bu işlem geri alınamaz. Proje silinir, ancak projeye bağlı makale dosyaları Drive üzerinde kalır."}
          </DialogDescription>
        </DialogHeader>

        {step === 2 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Proje silinince proje içindeki makale referansları kaldırılır. Makalelerin kendisi
                ve PDF dosyaları korunur.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => closeDialog(false)} disabled={deleting}>
            Vazgeç
          </Button>
          {step === 1 ? (
            <Button variant="destructive" onClick={() => setStep(2)}>
              Devam et
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Geri alınamaz, sil
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
