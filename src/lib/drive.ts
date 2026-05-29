import { google } from "googleapis"
import { Readable } from "stream"

// ─── Client factories ─────────────────────────────────────────────────────────

// Service-account singleton (long-lived, handles its own token refresh)
let _serviceAccountClient: ReturnType<typeof google.drive> | null = null

function buildServiceAccountClient(): ReturnType<typeof google.drive> {
  if (_serviceAccountClient) return _serviceAccountClient

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!
  let decoded: string
  try {
    decoded = Buffer.from(raw, "base64").toString("utf-8")
    JSON.parse(decoded)
  } catch {
    decoded = raw // already plain JSON
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

function buildUserOAuthClient(accessToken: string): ReturnType<typeof google.drive> {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({ access_token: accessToken })
  return google.drive({ version: "v3", auth })
}

/**
 * Returns a Drive client.
 *
 * Priority:
 *   1. Service account  (GOOGLE_SERVICE_ACCOUNT_JSON)  — preferred; shared access, no expiry
 *   2. User OAuth token (fallbackAccessToken)           — works while token is valid
 *
 * If neither is available the function throws a clear setup error.
 */
function getDriveClient(fallbackAccessToken?: string): ReturnType<typeof google.drive> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return buildServiceAccountClient()
  }
  if (fallbackAccessToken) {
    return buildUserOAuthClient(fallbackAccessToken)
  }
  throw new Error(
    "Drive credentials not configured. " +
      "Set GOOGLE_SERVICE_ACCOUNT_JSON (recommended) or ensure the session access token is available. " +
      "See README for service account setup."
  )
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

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

// ─── Public helpers ───────────────────────────────────────────────────────────
// Each function accepts an optional `accessToken` used as fallback when
// GOOGLE_SERVICE_ACCOUNT_JSON is not set (e.g. during initial local dev).

export async function createDriveFolder(
  name: string,
  parentId: string,
  accessToken?: string
): Promise<string> {
  const drive = getDriveClient(accessToken)
  const res = await withRetry(() =>
    drive.files.create({
      requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
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
  folderId: string,
  accessToken?: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = getDriveClient(accessToken)
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

export async function deleteFileFromDrive(
  fileId: string,
  accessToken?: string
): Promise<void> {
  const drive = getDriveClient(accessToken)
  await withRetry(() => drive.files.delete({ fileId }))
}

export async function listDriveFolders(
  parentId: string,
  accessToken?: string
): Promise<Array<{ id: string; name: string }>> {
  const drive = getDriveClient(accessToken)
  const res = await withRetry(() =>
    drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name)",
      orderBy: "name",
    })
  )
  return (res.data.files ?? []) as Array<{ id: string; name: string }>
}
