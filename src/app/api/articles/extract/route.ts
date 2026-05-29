import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { extractPdfMetadata } from "@/lib/pdf-metadata"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "PDF dosyası zorunludur" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const metadata = await extractPdfMetadata(buffer)
    return NextResponse.json(metadata)
  } catch (error) {
    console.error("PDF metadata extraction failed:", error)
    return NextResponse.json(
      { error: "PDF içeriği analiz edilemedi" },
      { status: 500 }
    )
  }
}

