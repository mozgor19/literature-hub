import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"

export const metadata: Metadata = {
  title: "Literature Hub",
  description: "Araştırma grubu makale havuzu",
  openGraph: {
    title: "Literature Hub",
    description: "Araştırma grubu makale havuzu",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Literature Hub",
    description: "Araştırma grubu makale havuzu",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
