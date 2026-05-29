import { google } from "googleapis"
import { Readable } from "stream"

function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({ access_token: accessToken })
  return google.drive({ version: "v3", auth })
}

export async function createDriveFolder(
  accessToken: string,
  name: string,
  parentId: string
): Promise<string> {
  const drive = getDriveClient(accessToken)
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  })
  if (!res.data.id) throw new Error("Drive folder creation returned no ID")
  return res.data.id
}

export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  folderId: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = getDriveClient(accessToken)
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id,webViewLink",
  })
  if (!res.data.id || !res.data.webViewLink) {
    throw new Error("Drive file upload returned incomplete data")
  }
  return { fileId: res.data.id, webViewLink: res.data.webViewLink }
}

export async function deleteFileFromDrive(
  accessToken: string,
  fileId: string
): Promise<void> {
  const drive = getDriveClient(accessToken)
  await drive.files.delete({ fileId })
}

export async function listDriveFolders(
  accessToken: string,
  parentId: string
): Promise<Array<{ id: string; name: string }>> {
  const drive = getDriveClient(accessToken)
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
    orderBy: "name",
  })
  return (res.data.files ?? []) as Array<{ id: string; name: string }>
}
