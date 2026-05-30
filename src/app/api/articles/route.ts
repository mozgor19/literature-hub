import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { supabase } from "@/lib/supabase"
import { uploadFileToDrive, createDriveFolder } from "@/lib/drive"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fieldId = searchParams.get("field_id")
  const tagIds = searchParams.get("tags")?.split(",").filter(Boolean) ?? []
  const authorIds = searchParams.get("authors")?.split(",").filter(Boolean) ?? []
  const orgIds = searchParams.get("orgs")?.split(",").filter(Boolean) ?? []
  const yearMin = searchParams.get("year_min") ? Number(searchParams.get("year_min")) : null
  const yearMax = searchParams.get("year_max") ? Number(searchParams.get("year_max")) : null
  const q = searchParams.get("q")?.trim()
  const mine = searchParams.get("mine") === "1"
  const readStatusFilter = searchParams.get("read_status") ?? "" // "reading" | "read" | "unread" | ""
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") ?? 25)))
  const offset = (page - 1) * limit

  // Tag AND filter: intersect article IDs for each selected tag (all in parallel)
  let tagFilteredIds: string[] | null = null
  if (tagIds.length > 0) {
    const tagResults = await Promise.all(
      tagIds.map((tagId) =>
        supabase.from("article_tags").select("article_id").eq("tag_id", tagId)
      )
    )
    const sets = tagResults.map((r) => new Set((r.data ?? []).map((t) => t.article_id)))
    tagFilteredIds = [...sets.reduce((a, b) => new Set([...a].filter((x) => b.has(x))), sets[0] ?? new Set<string>())]
  }

  // Author AND filter: same intersection semantics as tags
  let authorFilteredIds: string[] | null = null
  if (authorIds.length > 0) {
    const authorResults = await Promise.all(
      authorIds.map((authorId) =>
        supabase.from("article_authors").select("article_id").eq("author_id", authorId)
      )
    )
    const sets = authorResults.map((r) => new Set((r.data ?? []).map((t) => t.article_id)))
    authorFilteredIds = [...sets.reduce((a, b) => new Set([...a].filter((x) => b.has(x))), sets[0] ?? new Set<string>())]
  }

  // Org AND filter
  let orgFilteredIds: string[] | null = null
  if (orgIds.length > 0) {
    const orgResults = await Promise.all(
      orgIds.map((orgId) =>
        supabase.from("article_organizations").select("article_id").eq("org_id", orgId)
      )
    )
    const sets = orgResults.map((r) => new Set((r.data ?? []).map((t) => t.article_id)))
    orgFilteredIds = [...sets.reduce((a, b) => new Set([...a].filter((x) => b.has(x))), sets[0] ?? new Set<string>())]
  }

  // Field filter: include all descendants at any depth (recursive walk)
  let fieldIds: string[] | null = null
  if (fieldId) {
    async function collectDescendants(id: string): Promise<string[]> {
      const { data: children } = await supabase.from("fields").select("id").eq("parent_id", id)
      const childIds = (children ?? []).map((f) => f.id)
      const grandchildSets = await Promise.all(childIds.map(collectDescendants))
      return [id, ...childIds, ...grandchildSets.flat()]
    }
    fieldIds = await collectDescendants(fieldId)
  }

  let query = supabase
    .from("articles")
    .select(
      `id, title, authors, year, source_url, notes, drive_web_link, drive_folder_path, field_id, added_at, added_by,
      field:fields!field_id(id, name, parent_id),
      article_tags(tag_id, tags(id, name)),
      added_by_user:users!added_by(id, name, email)`,
      { count: "exact" }
    )
    .order("added_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (fieldIds) query = query.in("field_id", fieldIds)
  if (tagFilteredIds !== null) {
    query = query.in(
      "id",
      tagFilteredIds.length > 0 ? tagFilteredIds : ["00000000-0000-0000-0000-000000000000"]
    )
  }
  if (authorFilteredIds !== null) {
    query = query.in(
      "id",
      authorFilteredIds.length > 0 ? authorFilteredIds : ["00000000-0000-0000-0000-000000000000"]
    )
  }
  if (orgFilteredIds !== null) {
    query = query.in(
      "id",
      orgFilteredIds.length > 0 ? orgFilteredIds : ["00000000-0000-0000-0000-000000000000"]
    )
  }
  if (yearMin !== null) query = query.gte("year", yearMin)
  if (yearMax !== null) query = query.lte("year", yearMax)
  if (mine) query = query.eq("added_by", session.user.id)
  if (q) query = query.or(`title.ilike.%${q}%,authors.ilike.%${q}%,abstract.ilike.%${q}%`)

  // Read-status filter — scoped strictly to requesting user
  if (readStatusFilter === "reading" || readStatusFilter === "read") {
    const { data: rsData } = await supabase
      .from("article_read_status")
      .select("article_id")
      .eq("user_id", session.user.id)
      .eq("status", readStatusFilter)
    const ids = (rsData ?? []).map((r) => r.article_id)
    query = query.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"])
  } else if (readStatusFilter === "unread") {
    const { data: rsData } = await supabase
      .from("article_read_status")
      .select("article_id")
      .eq("user_id", session.user.id)
    const readIds = (rsData ?? []).map((r) => r.article_id)
    if (readIds.length > 0) {
      query = query.not("id", "in", `(${readIds.join(",")})`)
    }
    // If readIds is empty, all articles are unread — no extra filter needed
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch project counts, comment counts, normalized authors, and orgs in parallel
  const articleIds = (data ?? []).map((a) => a.id)
  const projectCountMap: Record<string, number> = {}
  const commentCountMap: Record<string, number> = {}
  const authorMap: Record<string, Array<{ id: string; name: string }>> = {}
  const orgMap: Record<string, Array<{ id: string; name: string }>> = {}
  const readStatusMap: Record<string, "reading" | "read"> = {}
  if (articleIds.length > 0) {
    const [pcResult, ccResult, aaResult, aoResult, rsResult] = await Promise.all([
      supabase.from("project_articles").select("article_id").in("article_id", articleIds),
      supabase.from("comments").select("article_id").in("article_id", articleIds).eq("is_deleted", false),
      supabase
        .from("article_authors")
        .select("article_id, position, author:authors!author_id(id, name)")
        .in("article_id", articleIds)
        .order("position"),
      supabase
        .from("article_organizations")
        .select("article_id, org:organizations!org_id(id, name)")
        .in("article_id", articleIds),
      supabase
        .from("article_read_status")
        .select("article_id, status")
        .eq("user_id", session.user.id)
        .in("article_id", articleIds),
    ])
    ;(pcResult.data ?? []).forEach((row) => {
      projectCountMap[row.article_id] = (projectCountMap[row.article_id] ?? 0) + 1
    })
    ;(ccResult.data ?? []).forEach((row) => {
      commentCountMap[row.article_id] = (commentCountMap[row.article_id] ?? 0) + 1
    })
    ;(aaResult.data ?? []).forEach((row) => {
      const a = row.author as { id: string; name: string } | null
      if (!a) return
      if (!authorMap[row.article_id]) authorMap[row.article_id] = []
      authorMap[row.article_id].push({ id: a.id, name: a.name })
    })
    ;(aoResult.data ?? []).forEach((row) => {
      const o = row.org as { id: string; name: string } | null
      if (!o) return
      if (!orgMap[row.article_id]) orgMap[row.article_id] = []
      orgMap[row.article_id].push({ id: o.id, name: o.name })
    })
    ;(rsResult.data ?? []).forEach((row) => {
      readStatusMap[row.article_id] = row.status as "reading" | "read"
    })
  }

  const articles = (data ?? []).map((a) => ({
    ...a,
    tags: (a.article_tags ?? []).map((at: { tags: unknown }) => at.tags).filter(Boolean),
    project_count: projectCountMap[a.id] ?? 0,
    comment_count: commentCountMap[a.id] ?? 0,
    normalized_authors: authorMap[a.id] ?? [],
    organizations: orgMap[a.id] ?? [],
    my_read_status: (readStatusMap[a.id] ?? "unread") as "unread" | "reading" | "read",
  }))

  const [totalArticlesResult, allReadStatusResult] = await Promise.all([
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase.from("article_read_status").select("status").eq("user_id", session.user.id),
  ])
  const readingCount = (allReadStatusResult.data ?? []).filter((row) => row.status === "reading").length
  const readCount = (allReadStatusResult.data ?? []).filter((row) => row.status === "read").length
  const articleCount = totalArticlesResult.count ?? 0
  const readStatusCounts = {
    unread: Math.max(0, articleCount - readingCount - readCount),
    reading: readingCount,
    read: readCount,
  }

  return NextResponse.json({
    articles,
    total: count ?? 0,
    page,
    limit,
    read_status_counts: readStatusCounts,
  })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const title = formData.get("title") as string
  const year = formData.get("year") ? Number(formData.get("year")) : null
  const abstract = (formData.get("abstract") as string) || null
  const source_url = (formData.get("source_url") as string) || null
  const notes = (formData.get("notes") as string) || null
  const field_id = formData.get("field_id") as string
  const tagIds = JSON.parse((formData.get("tag_ids") as string) || "[]") as string[]
  const newTagNames = JSON.parse((formData.get("new_tags") as string) || "[]") as string[]
  const existingAuthorIds = JSON.parse((formData.get("author_ids") as string) || "[]") as string[]
  const newAuthorNames = JSON.parse((formData.get("new_authors") as string) || "[]") as string[]
  const existingOrgIds = JSON.parse((formData.get("org_ids") as string) || "[]") as string[]
  const newOrgNames = JSON.parse((formData.get("new_orgs") as string) || "[]") as string[]
  const git_repo_url_raw = (formData.get("git_repo_url") as string | null)?.trim() || null
  // Light server-side URL validation
  const git_repo_url =
    git_repo_url_raw && /^https?:\/\/.+/.test(git_repo_url_raw) ? git_repo_url_raw : null

  if (!title?.trim() || !field_id) {
    return NextResponse.json({ error: "Başlık ve alan zorunludur" }, { status: 400 })
  }
  if (existingAuthorIds.length === 0 && newAuthorNames.length === 0) {
    return NextResponse.json({ error: "En az bir yazar ekleyin" }, { status: 400 })
  }
  if (!file) {
    return NextResponse.json({ error: "PDF dosyası zorunludur" }, { status: 400 })
  }

  // Fetch field + its parent in ONE query (eliminates the duplicate parent query)
  type FieldRow = {
    id: string
    name: string
    parent_id: string | null
    drive_folder_id: string | null
    parent_field: { id: string; name: string; drive_folder_id: string | null } | null
  }
  const { data: field } = await supabase
    .from("fields")
    .select(
      `id, name, parent_id, drive_folder_id,
      parent_field:fields!parent_id(id, name, drive_folder_id)`
    )
    .eq("id", field_id)
    .single() as { data: FieldRow | null }

  if (!field) return NextResponse.json({ error: "Alan bulunamadı" }, { status: 404 })

  const parentField = field.parent_field
  const parentName = parentField?.name ?? null
  const driveFolderPath = parentName ? `${parentName} / ${field.name}` : field.name

  // Fallback token used when GOOGLE_SERVICE_ACCOUNT_JSON is not set
  const fallbackToken = session.accessToken

  // Ensure field has a Drive folder; create it (and parent folder) if missing
  let driveFolderId = field.drive_folder_id
  if (!driveFolderId) {
    let driveParentId = process.env.DRIVE_ROOT_FOLDER_ID!

    if (field.parent_id && parentField) {
      if (!parentField.drive_folder_id) {
        const newParentId = await createDriveFolder(parentName ?? field.name, process.env.DRIVE_ROOT_FOLDER_ID!, fallbackToken)
        await supabase.from("fields").update({ drive_folder_id: newParentId }).eq("id", field.parent_id)
        driveParentId = newParentId
      } else {
        driveParentId = parentField.drive_folder_id
      }
    }

    try {
      driveFolderId = await createDriveFolder(field.name, driveParentId, fallbackToken)
      await supabase.from("fields").update({ drive_folder_id: driveFolderId }).eq("id", field_id)
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
      file.name || `${title}.pdf`,
      file.type || "application/pdf",
      buffer,
      driveFolderId,
      fallbackToken
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
    const { data: createdTags, error: tagErr } = await supabase
      .from("tags")
      .upsert(
        newTagNames.map((name) => ({ name: name.trim().toLowerCase() })),
        { onConflict: "name" }
      )
      .select("id")
    if (tagErr) {
      return NextResponse.json(
        { error: `Etiketler oluşturulamadı: ${tagErr.message}` },
        { status: 500 }
      )
    }
    allTagIds = [...allTagIds, ...(createdTags ?? []).map((t) => t.id)]
  }

  // Upsert new authors and collect all author IDs in position order
  let allAuthorIds = [...existingAuthorIds]
  if (newAuthorNames.length > 0) {
    const { data: upserted, error: authorErr } = await supabase
      .from("authors")
      .upsert(
        newAuthorNames.map((name) => ({ name: name.trim() })),
        { onConflict: "name" }
      )
      .select("id, name")
    if (authorErr) {
      return NextResponse.json({ error: `Yazarlar kaydedilemedi: ${authorErr.message}` }, { status: 500 })
    }
    // Preserve the order submitted by the client: existing first, then new
    allAuthorIds = [...allAuthorIds, ...(upserted ?? []).map((a) => a.id)]
  }

  // Derive the free-text authors string (reading order) for backward compat + display
  const { data: authorRows } = await supabase
    .from("authors")
    .select("id, name")
    .in("id", allAuthorIds)
  const authorNameById = Object.fromEntries((authorRows ?? []).map((a) => [a.id, a.name]))
  const authorsText = allAuthorIds.map((id) => authorNameById[id] ?? "").filter(Boolean).join(", ")

  // Insert article row
  const { data: article, error: articleErr } = await supabase
    .from("articles")
    .insert({
      title: title.trim(),
      authors: authorsText,
      year,
      abstract: abstract || null,
      source_url: source_url || null,
      notes: notes || null,
      git_repo_url,
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

  // Link authors to article (position = index in allAuthorIds)
  if (allAuthorIds.length > 0) {
    await supabase.from("article_authors").upsert(
      allAuthorIds.map((authorId, position) => ({ article_id: article.id, author_id: authorId, position })),
      { onConflict: "article_id,author_id" }
    )
  }

  // Insert tag links
  if (allTagIds.length > 0) {
    await supabase
      .from("article_tags")
      .upsert(
        allTagIds.map((tagId) => ({ article_id: article.id, tag_id: tagId })),
        { onConflict: "article_id,tag_id" }
      )
  }

  // Upsert organizations and link to article
  let allOrgIds = [...existingOrgIds]
  if (newOrgNames.length > 0) {
    const { data: upsertedOrgs } = await supabase
      .from("organizations")
      .upsert(
        newOrgNames.map((name) => ({ name: name.trim() })),
        { onConflict: "name" }
      )
      .select("id")
    allOrgIds = [...allOrgIds, ...(upsertedOrgs ?? []).map((o) => o.id)]
  }
  if (allOrgIds.length > 0) {
    await supabase
      .from("article_organizations")
      .upsert(
        allOrgIds.map((orgId) => ({ article_id: article.id, org_id: orgId })),
        { onConflict: "article_id,org_id" }
      )
  }

  return NextResponse.json(article, { status: 201 })
}
