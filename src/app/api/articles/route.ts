import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { uploadFileToDrive, createDriveFolder } from "@/lib/drive"
import { getDriveAuthForRequest } from "@/lib/google-auth"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fieldId = searchParams.get("field_id")
  const tagIds = searchParams.get("tags")?.split(",").filter(Boolean) ?? []
  const yearMin = searchParams.get("year_min") ? Number(searchParams.get("year_min")) : null
  const yearMax = searchParams.get("year_max") ? Number(searchParams.get("year_max")) : null
  const q = searchParams.get("q")?.trim()
  const mine = searchParams.get("mine") === "1"
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") ?? 25)))
  const offset = (page - 1) * limit

  // Resolve tag AND filter: get intersection of article IDs for each tag
  let tagFilteredIds: string[] | null = null
  if (tagIds.length > 0) {
    const tagQueries = await Promise.all(
      tagIds.map((tagId) =>
        supabase.from("article_tags").select("article_id").eq("tag_id", tagId)
      )
    )
    const sets = tagQueries.map(
      (r) => new Set((r.data ?? []).map((t) => t.article_id))
    )
    const intersection = sets.reduce(
      (a, b) => new Set([...a].filter((x) => b.has(x))),
      sets[0] ?? new Set<string>()
    )
    tagFilteredIds = [...intersection]
  }

  let query = supabase
    .from("articles")
    .select(
      `id, title, authors, year, source_url, notes, drive_web_link, drive_folder_path, field_id, added_at,
      field:fields!field_id(id, name, parent_id),
      article_tags(tag_id, tags(id, name)),
      added_by_user:users!added_by(id, name, email)`,
      { count: "exact" }
    )
    .order("added_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (fieldId) {
    // Include field and its children
    const { data: childFields } = await supabase
      .from("fields")
      .select("id")
      .eq("parent_id", fieldId)
    const fieldIds = [fieldId, ...(childFields ?? []).map((f) => f.id)]
    query = query.in("field_id", fieldIds)
  }

  if (tagFilteredIds !== null) {
    query = query.in(
      "id",
      tagFilteredIds.length > 0 ? tagFilteredIds : ["00000000-0000-0000-0000-000000000000"]
    )
  }

  if (yearMin !== null) query = query.gte("year", yearMin)
  if (yearMax !== null) query = query.lte("year", yearMax)
  if (mine) query = query.eq("added_by", session.user.id)

  if (q) {
    query = query.or(`title.ilike.%${q}%,authors.ilike.%${q}%,abstract.ilike.%${q}%`)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get project counts for returned articles
  const articleIds = (data ?? []).map((a) => a.id)
  const projectCountMap: Record<string, number> = {}
  if (articleIds.length > 0) {
    const { data: pcData } = await supabase
      .from("project_articles")
      .select("article_id")
      .in("article_id", articleIds)
    ;(pcData ?? []).forEach((row) => {
      projectCountMap[row.article_id] = (projectCountMap[row.article_id] ?? 0) + 1
    })
  }

  const articles = (data ?? []).map((a) => ({
    ...a,
    tags: (a.article_tags ?? []).map((at: { tags: unknown }) => at.tags).filter(Boolean),
    project_count: projectCountMap[a.id] ?? 0,
  }))

  return NextResponse.json({ articles, total: count ?? 0, page, limit })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const driveAuth = await getDriveAuthForRequest(request, session.accessToken)

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const title = formData.get("title") as string
  const authors = formData.get("authors") as string
  const year = formData.get("year") ? Number(formData.get("year")) : null
  const abstract = (formData.get("abstract") as string) || null
  const source_url = (formData.get("source_url") as string) || null
  const notes = (formData.get("notes") as string) || null
  const field_id = formData.get("field_id") as string
  const tagIds = JSON.parse((formData.get("tag_ids") as string) || "[]") as string[]
  const newTagNames = JSON.parse((formData.get("new_tags") as string) || "[]") as string[]

  if (!title?.trim() || !authors?.trim() || !field_id) {
    return NextResponse.json(
      { error: "Başlık, yazarlar ve alan zorunludur" },
      { status: 400 }
    )
  }
  if (!file) {
    return NextResponse.json({ error: "PDF dosyası zorunludur" }, { status: 400 })
  }
  if (!driveAuth) {
    return NextResponse.json({ error: "Drive erişim tokeni bulunamadı" }, { status: 401 })
  }

  // Resolve field + build folder path
  const { data: field } = await supabase
    .from("fields")
    .select("id, name, parent_id, drive_folder_id")
    .eq("id", field_id)
    .single()

  if (!field) return NextResponse.json({ error: "Alan bulunamadı" }, { status: 404 })

  // Resolve parent for folder path display
  let parentName: string | null = null
  if (field.parent_id) {
    const { data: parent } = await supabase
      .from("fields")
      .select("name")
      .eq("id", field.parent_id)
      .single()
    parentName = parent?.name ?? null
  }
  const driveFolderPath = parentName ? `${parentName} / ${field.name}` : field.name

  // Ensure the field has a Drive folder; create it if missing
  let driveFolderId = field.drive_folder_id
  if (!driveFolderId) {
    let driveParentId = process.env.DRIVE_ROOT_FOLDER_ID!
    if (field.parent_id) {
      const { data: parentField } = await supabase
        .from("fields")
        .select("drive_folder_id")
        .eq("id", field.parent_id)
        .single()
      // Create parent folder first if it also doesn't have one
      if (!parentField?.drive_folder_id) {
        const newParentFolderId = await createDriveFolder(
          driveAuth,
          parentName ?? field.name,
          process.env.DRIVE_ROOT_FOLDER_ID!
        )
        await supabase
          .from("fields")
          .update({ drive_folder_id: newParentFolderId })
          .eq("id", field.parent_id)
        driveParentId = newParentFolderId
      } else {
        driveParentId = parentField.drive_folder_id
      }
    }
    try {
      driveFolderId = await createDriveFolder(
        driveAuth,
        field.name,
        driveParentId
      )
      await supabase
        .from("fields")
        .update({ drive_folder_id: driveFolderId })
        .eq("id", field_id)
    } catch (err) {
      console.error("Drive folder creation failed:", err)
      return NextResponse.json({ error: "Drive klasörü oluşturulamadı" }, { status: 500 })
    }
  }

  // Upload PDF to Drive
  let driveFileId: string
  let driveWebLink: string
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadFileToDrive(
      driveAuth,
      file.name || `${title}.pdf`,
      file.type || "application/pdf",
      buffer,
      driveFolderId
    )
    driveFileId = result.fileId
    driveWebLink = result.webViewLink
  } catch (err) {
    console.error("Drive upload failed:", err)
    return NextResponse.json({ error: "Drive dosyası yüklenemedi" }, { status: 500 })
  }

  // Upsert new tags
  let allTagIds = [...tagIds]
  if (newTagNames.length > 0) {
    const tagInserts = newTagNames.map((name) => ({ name: name.trim().toLowerCase() }))
    const { data: createdTags, error: tagErr } = await supabase
      .from("tags")
      .upsert(tagInserts, { onConflict: "name" })
      .select("id")
    if (tagErr) {
      // Drive file already uploaded – surface the error but note Drive file exists
      return NextResponse.json(
        { error: `Etiketler oluşturulamadı: ${tagErr.message}` },
        { status: 500 }
      )
    }
    allTagIds = [...allTagIds, ...(createdTags ?? []).map((t) => t.id)]
  }

  // Insert article
  const { data: article, error: articleErr } = await supabase
    .from("articles")
    .insert({
      title: title.trim(),
      authors: authors.trim(),
      year,
      abstract: abstract || null,
      source_url: source_url || null,
      notes: notes || null,
      field_id,
      drive_file_id: driveFileId,
      drive_web_link: driveWebLink,
      drive_folder_path: driveFolderPath,
      added_by: session.user.id,
    })
    .select("*")
    .single()

  if (articleErr) {
    return NextResponse.json(
      { error: `Makale kaydedilemedi: ${articleErr.message}. Drive dosyası yüklendi (ID: ${driveFileId}).` },
      { status: 500 }
    )
  }

  // Insert article_tags
  if (allTagIds.length > 0) {
    const tagLinks = allTagIds.map((tagId) => ({
      article_id: article.id,
      tag_id: tagId,
    }))
    await supabase.from("article_tags").upsert(tagLinks, { onConflict: "article_id,tag_id" })
  }

  return NextResponse.json(article, { status: 201 })
}
