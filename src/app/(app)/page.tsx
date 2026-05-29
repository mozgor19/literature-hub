import { redirect } from "next/navigation"

// The (app) root "/" → use app/page.tsx which redirects to "/articles"
export default function AppRootPage() {
  redirect("/articles")
}
