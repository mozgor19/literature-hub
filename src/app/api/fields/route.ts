import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { createDriveFolder } from "@/lib/drive"
import type { FieldWithChildren } from "@/types/database"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: fields, error } = await supabase
    .from("fields")
    .select("*")
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build tree in memory
  const topLevel = (fields ?? []).filter((f) => f.parent_id === null)
  const subfields = (fields ?? []).filter((f) => f.parent_id !== null)

  const tree: FieldWithChildren[] = topLevel.map((f) => ({
    ...f,
    children: subfields.filter((c) => c.parent_id === f.id),
  }))

  return NextResponse.json(tree)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { name, parent_id } = body as { name: string; parent_id?: string | null }

  if (!name?.trim()) {
    return NextResponse.json({ error: "Alan adı zorunludur" }, { status: 400 })
  }

  // Determine the Drive parent folder
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

  // Create the Drive folder
  let driveFolderId: string | null = null
  if (session.accessToken) {
    try {
      driveFolderId = await createDriveFolder(session.accessToken, name.trim(), driveParentId)
    } catch (err) {
      console.error("Drive folder creation failed:", err)
      return NextResponse.json({ error: "Drive klasörü oluşturulamadı" }, { status: 500 })
    }
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
  return NextResponse.json(field, { status: 201 })
}
