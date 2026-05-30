import { ImageResponse } from "next/og"

export const runtime = "edge"

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: "#2563eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "36px",
          fontSize: "110px",
        }}
      >
        📖
      </div>
    ),
    { width: 192, height: 192 }
  )
}
