/**
 * Admin check is driven by the ADMIN_EMAILS environment variable (comma-separated).
 * This is evaluated server-side only; never trust a client-sent flag.
 *
 * Example:  ADMIN_EMAILS=alice@example.com,bob@example.com
 */

function getAdminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? ""
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isAdmin(email?: string | null): boolean {
  if (!email) return false
  return getAdminEmailSet().has(email.trim().toLowerCase())
}
