import { NextResponse } from "next/server"
import { unstable_cache, revalidateTag } from "next/cache"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { createDriveFolder } from "@/lib/drive"
import type { FieldWithChildren } from "@/types/database"

import type { DBField } from "@/types/database"

function buildFieldTree(flat: DBField[], parentId: string | null = null): FieldWithChildren[] {
  return flat
    .filter((f) => f.parent_id === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({ ...f, children: buildFieldTree(flat, f.id) }))
}

// Fields change rarely (only on create). Cache the tree server-side and
// invalidate via a tag so every page load doesn't hit Supabase.
const getCachedFields = unstable_cache(
  async (): Promise<FieldWithChildren[]> => {
    const { data, error } = await supabase.from("fields").select("*")
    if (error) throw new Error(error.message)
    return buildFieldTree(data ?? [])
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
  const fallbackToken = session.accessToken
  let driveParentId = process.env.DRIVE_ROOT_FOLDER_ID!
  if (parent_id) {
    const { data: parentField } = await supabase
      .from("fields")
      .select("id, name, drive_folder_id")
      .eq("id", parent_id)
      .single()
    if (parentField?.drive_folder_id) {
      driveParentId = parentField.drive_folder_id
    } else if (parentField) {
      // Parent field exists but has no Drive folder yet — create it now
      try {
        const newFolderId = await createDriveFolder(
          parentField.name,
          process.env.DRIVE_ROOT_FOLDER_ID!,
          fallbackToken
        )
        await supabase.from("fields").update({ drive_folder_id: newFolderId }).eq("id", parent_id)
        driveParentId = newFolderId
      } catch (err) {
        console.error("Parent Drive folder creation failed, falling back to root:", err)
      }
    }
  }

  // Create Drive folder (service account preferred; user token as fallback)
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
