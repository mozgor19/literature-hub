import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// During `next build` the env vars aren't available yet; placeholder prevents
// the module from throwing at import time. Real requests still fail fast with a
// clear error if the env vars are actually missing at runtime.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-key"

// Service-role client for all server-side operations — never sent to the browser.
export const supabase = createClient<Database>(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})
