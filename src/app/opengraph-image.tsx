import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        background: "white",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0px",
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "8px",
          background: "#2563eb",
          display: "flex",
        }}
      />

      {/* Icon + title row */}
      <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
        <div
          style={{
            display: "flex",
            width: "100px",
            height: "100px",
            background: "#eff6ff",
            borderRadius: "20px",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "58px",
          }}
        >
          📖
        </div>
        <span
          style={{
            fontSize: "80px",
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-2px",
            lineHeight: 1,
          }}
        >
          Literature Hub
        </span>
      </div>

      {/* Subtitle */}
      <div
        style={{
          display: "flex",
          marginTop: "28px",
          fontSize: "32px",
          color: "#64748b",
          letterSpacing: "-0.5px",
        }}
      >
        Araştırma grubu makale havuzu
      </div>

      {/* Bottom accent */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "#e2e8f0",
          display: "flex",
        }}
      />
    </div>,
    { ...size }
  )
}
