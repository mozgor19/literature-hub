export const APP_OWNER_EMAIL = "mustafayapayzeka@gmail.com"

export function isAppOwner(email?: string | null): boolean {
  return email?.toLowerCase() === APP_OWNER_EMAIL
}

