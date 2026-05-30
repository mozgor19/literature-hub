import { ImageResponse } from "next/og"

export const runtime = "edge"

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
          borderRadius: "96px",
          fontSize: "300px",
        }}
      >
        📖
      </div>
    ),
    { width: 512, height: 512 }
  )
}
