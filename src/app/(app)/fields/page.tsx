import { FieldTree } from "@/components/fields/FieldTree"

export const metadata = { title: "Alanlar – Literature Hub" }

export default function FieldsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Araştırma Alanları</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Alan hiyerarşisi — her alan bir Google Drive klasörüne karşılık gelir
        </p>
      </div>
      <div className="max-w-2xl">
        <FieldTree />
      </div>
    </div>
  )
}
