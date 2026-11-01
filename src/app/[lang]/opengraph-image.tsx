import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "What Patrik Thinks";

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fbf4e9", alignItems: "center", padding: 80, gap: 60 }}>
        <div style={{ display: "flex", width: 360, height: 360, borderRadius: 999, background: "#a8dadc", border: "8px solid #221b16", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: 40, width: 90, height: 90, borderRadius: 99, background: "#3b2a20", border: "7px solid #221b16" }} />
          <div style={{ display: "flex", width: 200, height: 220, borderRadius: 999, background: "#e8b48f", border: "7px solid #221b16", marginTop: 60, alignItems: "center", justifyContent: "center", gap: 14 }}>
            <div style={{ width: 62, height: 62, borderRadius: 99, background: "#fff", border: "7px solid #221b16" }} />
            <div style={{ width: 62, height: 62, borderRadius: 99, background: "#fff", border: "7px solid #221b16" }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 84, fontWeight: 800, color: "#221b16", lineHeight: 1 }}>What Patrik Thinks</div>
          <div style={{ fontSize: 46, color: "#5b5149", marginTop: 28, lineHeight: 1.2 }}>Send Patrik your chat. He&apos;ll tell you what&apos;s really going on.</div>
          <div style={{ display: "flex", marginTop: 40, background: "#e4572e", color: "#fff", fontSize: 34, padding: "16px 34px", borderRadius: 999, border: "5px solid #221b16", alignSelf: "flex-start" }}>whatpatrikthink.com</div>
        </div>
      </div>
    ),
    size,
  );
}
