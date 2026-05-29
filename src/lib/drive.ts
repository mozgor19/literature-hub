import { google } from "googleapis"
import { Readable } from "stream"

// ─── Service-account client (singleton per process) ─────────────────────────
// All Drive operations go through a service account so that:
//  1. User OAuth only requests basic (non-sensitive) scopes → no consent warning
//  2. The shared folder is always accessible regardless of which user is signed in
//  3. Token expiry / refresh is handled automatically by the googleapis JWT client

let _serviceAccountClient: ReturnType<typeof google.drive> | null = null

function getServiceAccountDriveClient(): ReturnType<typeof google.drive> {
  if (_serviceAccountClient) return _serviceAccountClient

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not set. " +
        "Create a service account, share the Drive root folder with it, " +
        "and set the env var to the base64-encoded key JSON. See README."
    )
  }

  // Accept plain JSON or base64-encoded JSON
  let decoded: string
  try {
    decoded = Buffer.from(raw, "base64").toString("utf-8")
    JSON.parse(decoded) // validate
  } catch {
    decoded = raw
  }

  const key = JSON.parse(decoded) as { client_email: string; private_key: string }

  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  })

  _serviceAccountClient = google.drive({ version: "v3", auth })
  return _serviceAccountClient
}

// ─── Retry helper ────────────────────────────────────────────────────────────
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 600
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryable(err) || attempt === maxAttempts) break
      // Exponential backoff + small jitter
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 300
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; code?: number; errors?: Array<{ reason?: string }> }
  const status = e.status ?? e.code
  if (typeof status === "number" && RETRYABLE_STATUS.has(status)) return true
  if (e.errors?.[0]?.reason === "rateLimitExceeded") return true
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes("econnreset") || msg.includes("socket hang up") || msg.includes("etimedout")) {
      return true
    }
  }
  return false
}

// ─── Public Drive helpers ────────────────────────────────────────────────────

export async function createDriveFolder(name: string, parentId: string): Promise<string> {
  const drive = getServiceAccountDriveClient()
  const res = await withRetry(() =>
    drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    })
  )
  if (!res.data.id) throw new Error("Drive folder creation returned no ID")
  return res.data.id
}

export async function uploadFileToDrive(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  folderId: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = getServiceAccountDriveClient()
  const res = await withRetry(() =>
    drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType, body: Readable.from(buffer) },
      fields: "id,webViewLink",
    })
  )
  if (!res.data.id || !res.data.webViewLink) {
    throw new Error("Drive file upload returned incomplete data")
  }
  return { fileId: res.data.id, webViewLink: res.data.webViewLink }
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = getServiceAccountDriveClient()
  await withRetry(() => drive.files.delete({ fileId }))
}

export async function listDriveFolders(
  parentId: string
): Promise<Array<{ id: string; name: string }>> {
  const drive = getServiceAccountDriveClient()
  const res = await withRetry(() =>
    drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name)",
      orderBy: "name",
    })
  )
  return (res.data.files ?? []) as Array<{ id: string; name: string }>
}
