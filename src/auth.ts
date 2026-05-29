import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { supabase } from "@/lib/supabase"

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

        const { data: dbUser } = await supabase
          .from("users")
          .upsert(
            {
              email: user.email!,
              name: user.name ?? null,
              image: user.image ?? null,
            },
            { onConflict: "email" }
          )
          .select("id")
          .single()

        token.dbUserId = dbUser?.id ?? undefined
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken ?? undefined
      session.user.id = token.dbUserId ?? token.sub!
      return session
    },
  },
})
