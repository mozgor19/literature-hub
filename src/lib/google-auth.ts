import { getToken } from "next-auth/jwt"

export interface DriveAuthCredentials {
  accessToken: string
  refreshToken?: string
}

export async function getDriveAuthForRequest(
  request: Request,
  fallbackAccessToken?: string
): Promise<DriveAuthCredentials | null> {
  const token = await getToken({
    req: request as never,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  })

  const accessToken = token?.accessToken ?? fallbackAccessToken
  if (!accessToken) return null

  return {
    accessToken,
    refreshToken: token?.refreshToken,
  }
}

