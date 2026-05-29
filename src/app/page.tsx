import { redirect } from "next/navigation"

// "/" → "/articles" is the canonical home route.
// This avoids a conflict with the (app) route group's page.tsx.
export default function RootRedirect() {
  redirect("/articles")
}
