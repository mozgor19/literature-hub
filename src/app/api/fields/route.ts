import { NextResponse } from "next/server"
import { unstable_cache, revalidateTag } from "next/cache"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { createDriveFolder } from "@/lib/drive"
import type { FieldWithChildren } from "@/types/database"

// Fields change rarely (only on create). Cache the tree server-side and
// invalidate via a tag so every page load doesn't hit Supabase.
const getCachedFields = unstable_cache(
  async (): Promise<FieldWithChildren[]> => {
    const { data, error } = await supabase
      .from("fields")
      .select("*")
      .order("name")
    if (error) throw new Error(error.message)
    const fields = data ?? []
    const topLevel = fields.filter((f) => f.parent_id === null)
    const subfields = fields.filter((f) => f.parent_id !== null)
    return topLevel.map((f) => ({
      ...f,
      children: subfields.filter((c) => c.parent_id === f.id),
    }))
  },
  ["fields-tree"],
  { tags: ["fields"], revalidate: 300 }
)

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const tree = await getCachedFields()
    return NextResponse.json(tree)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { name, parent_id } = body as { name: string; parent_id?: string | null }

  if (!name?.trim()) {
    return NextResponse.json({ error: "Alan adı zorunludur" }, { status: 400 })
  }

  // Determine Drive parent folder
  let driveParentId = process.env.DRIVE_ROOT_FOLDER_ID!
  if (parent_id) {
    const { data: parentField } = await supabase
      .from("fields")
      .select("drive_folder_id")
      .eq("id", parent_id)
      .single()
    if (parentField?.drive_folder_id) {
      driveParentId = parentField.drive_folder_id
    }
  }

  // Create Drive folder (service account preferred; user token as fallback)
  const fallbackToken = session.accessToken
  let driveFolderId: string | null = null
  try {
    driveFolderId = await createDriveFolder(name.trim(), driveParentId, fallbackToken)
  } catch (err) {
    console.error("Drive folder creation failed:", err)
    return NextResponse.json({ error: "Drive klasörü oluşturulamadı" }, { status: 500 })
  }

  const { data: field, error } = await supabase
    .from("fields")
    .insert({
      name: name.trim(),
      parent_id: parent_id ?? null,
      drive_folder_id: driveFolderId,
      created_by: session.user.id,
    })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Invalidate cached tree — Next.js 16 requires a second "profile" argument
  revalidateTag("fields", "max")

  return NextResponse.json(field, { status: 201 })
}
