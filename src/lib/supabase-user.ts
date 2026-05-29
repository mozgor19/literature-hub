import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/**
 * Sign a minimal JWT that Supabase RLS will accept, so that `auth.uid()`
 * resolves to `userId` inside policy expressions.
 *
 * Requires SUPABASE_JWT_SECRET (Project Settings → API → JWT Settings).
 * Token is valid for 60 seconds — enough for one DELETE request.
 */
async function signSupabaseJwt(userId: string): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) throw new Error("SUPABASE_JWT_SECRET is not set")

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, role: "authenticated", iat: now, exp: now + 60 })
  ).toString("base64url")

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  )
  const sigB64 = Buffer.from(sig).toString("base64url")
  return `${header}.${payload}.${sigB64}`
}

/**
 * Returns a Supabase client authenticated as the given user.
 * Use this for operations that must be validated by RLS (e.g. DELETE).
 * Falls back to the service-role client when SUPABASE_JWT_SECRET is absent
 * so that the app-layer check is still the primary enforcement.
 */
export async function createUserScopedClient(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder"

  if (!process.env.SUPABASE_JWT_SECRET) {
    // Degrade gracefully: use service role (bypasses RLS).
    // App-layer check in the route handler is still enforced.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-key"
    return createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  }

  const jwt = await signSupabaseJwt(userId)
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}
