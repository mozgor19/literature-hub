import { ImageResponse } from "next/og"

export const runtime = "edge"

// Maskable icon: content in the central 80% safe zone, full bleed background
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#2563eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "240px", // smaller to stay inside safe zone
        }}
      >
        📖
      </div>
    ),
    { width: 512, height: 512 }
  )
}
