/** Simple, original monochrome app badges (no third-party logos). */
const APPS: Record<string, { label: string; bg: string; glyph: string }> = {
  whatsapp: { label: "WhatsApp", bg: "#8db596", glyph: "W" },
  telegram: { label: "Telegram", bg: "#a8dadc", glyph: "T" },
  imessage: { label: "iMessage", bg: "#a8c8f0", glyph: "i" },
  instagram: { label: "Instagram", bg: "#f4c7c3", glyph: "Ig" },
  messenger: { label: "Messenger", bg: "#cdb4db", glyph: "M" },
  line: { label: "LINE", bg: "#b8e0b0", glyph: "L" },
  kakaotalk: { label: "KakaoTalk", bg: "#f6d776", glyph: "K" },
  other: { label: "Other", bg: "#e8e1d6", glyph: "…" },
};
export const APP_KEYS = ["whatsapp", "telegram", "imessage", "instagram", "messenger", "line", "kakaotalk", "other"] as const;
export const appLabel = (k: string) => APPS[k]?.label ?? k;

export function AppBadge({ app, size = 28 }: { app: string; size?: number }) {
  const a = APPS[app] ?? APPS.other;
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-lg border-2 border-ink font-bold text-ink"
      style={{ width: size, height: size, background: a.bg, fontSize: size * 0.42 }}
    >
      {a.glyph}
    </span>
  );
}
