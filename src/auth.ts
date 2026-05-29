import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { supabase } from "@/lib/supabase"

async function refreshGoogleAccessToken(token: {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
}) {
  if (!token.refreshToken) {
    throw new Error("Google refresh token bulunamadı")
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  })

  const tokens = await response.json() as {
    access_token?: string
    expires_in?: number
    refresh_token?: string
    error?: string
    error_description?: string
  }

  if (!response.ok || !tokens.access_token || !tokens.expires_in) {
    throw new Error(tokens.error_description ?? tokens.error ?? "Google access token yenilenemedi")
  }

  return {
    ...token,
    accessToken: tokens.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    refreshToken: tokens.refresh_token ?? token.refreshToken,
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        // First sign-in: persist/refresh Drive tokens and sync user to DB
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at

        const adminEmails = new Set(
          (process.env.ADMIN_EMAILS ?? "")
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean)
        )
        const isAdminUser = adminEmails.has((user.email ?? "").toLowerCase())

        const { data: dbUser, error: upsertError } = await supabase
          .from("users")
          .upsert(
            {
              email: user.email!,
              name: user.name ?? null,
              image: user.image ?? null,
              is_admin: isAdminUser,
            },
            { onConflict: "email" }
          )
          .select("id")
          .single()

        if (upsertError || !dbUser?.id) {
          // Surface the error instead of silently falling back to the Google
          // sub — a mismatched user.id would break all ownership checks.
          throw new Error(`DB user upsert failed: ${upsertError?.message ?? "no id returned"}`)
        }

        token.dbUserId = dbUser.id
        return token
      }

      if (token.expiresAt && token.expiresAt > Math.floor(Date.now() / 1000) + 60) {
        return token
      }

      try {
        return await refreshGoogleAccessToken(token)
      } catch (error) {
        console.error("Google token refresh failed:", error)
        token.error = "RefreshAccessTokenError"
      }

      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken ?? undefined
      session.user.id = token.dbUserId ?? token.sub!
      session.error = token.error
      return session
    },
  },
})
