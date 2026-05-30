import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"
import { PwaRegister } from "@/components/layout/PwaRegister"

export const metadata: Metadata = {
  title: "Literature Hub",
  description: "Araştırma grubu makale havuzu",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LitHub",
  },
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

export const viewport: Viewport = {
  themeColor: "#2563eb",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  )
}
