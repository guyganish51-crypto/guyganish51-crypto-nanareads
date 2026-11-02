import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PATRIK_DATA_URI } from "@/lib/site/patrik";
import { supabaseAdmin } from "@/lib/supabase/server";
import { wrap, visualLine, isHebrew, needsShaping } from "@/lib/site/bidi";

const fonts = (async () => {
  const f = (n: string) => readFile(join(process.cwd(), "assets/fonts", n));
  const [latin, hebrew, cyrillic, regular] = await Promise.all([
    f("rubik-latin-700-normal.woff"), f("rubik-hebrew-700-normal.woff"), f("rubik-cyrillic-700-normal.woff"), f("rubik-latin-400-normal.woff"),
  ]);
  return [
    { name: "Rubik", data: latin, weight: 700 as const, style: "normal" as const },
    { name: "Rubik", data: hebrew, weight: 700 as const, style: "normal" as const },
    { name: "Rubik", data: cyrillic, weight: 700 as const, style: "normal" as const },
    { name: "Rubik", data: regular, weight: 400 as const, style: "normal" as const },
  ];
})();

/** Share card for a report (?p=<index> for one person's card). */
export async function GET(req: Request, ctx: RouteContext<"/api/og/[id]">) {
  const { id } = await ctx.params;
  const pIdx = new URL(req.url).searchParams.get("p");
  let title = "What Patrik Thinks", sub = "Send Patrik your chat. He'll tell you what's really going on.", kicker = "";
  try {
    if (/^[0-9a-f-]{36}$/.test(id)) {
      const { data } = await supabaseAdmin().from("reports").select("title, preview, content, unlocked").eq("id", id).maybeSingle();
      if (data?.title) title = data.title;
      const people = (data?.content?.report?.people ?? data?.preview?.people ?? []) as { name: string; title: string }[];
      if (pIdx != null && people[Number(pIdx)]) {
        const person = people[Number(pIdx)];
        kicker = title; title = person.name; sub = person.title;
      } else if (data?.preview?.verdict_teaser) sub = data.preview.verdict_teaser;
    }
  } catch { /* fall back to the brand card */ }
  if (process.env.OG_DEBUG === "1") {
    const q = new URL(req.url).searchParams;
    title = q.get("t") ?? title; sub = q.get("s") ?? sub; kicker = q.get("k") ?? kicker;
  }
  const all = `${title} ${sub} ${kicker}`;
  const shaped = needsShaping(all);
  if (shaped) { title = "What Patrik Thinks"; sub = "whatpatrikthink.com"; kicker = ""; }
  const rtl = isHebrew(all);
  const titleLines = wrap(title, kicker ? 22 : 30).slice(0, 3).map((l) => visualLine(l, rtl));
  const subLines = wrap(sub, 48).slice(0, 3).map((l) => visualLine(l, rtl));
  const kickerLine = kicker ? visualLine(wrap(kicker, 60)[0] ?? "", rtl) : "";
  const align = rtl ? "flex-end" : "flex-start";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: rtl ? "row-reverse" : "row", background: "#fbf4e9", padding: 64, gap: 48, fontFamily: "Rubik", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PATRIK_DATA_URI} width={250} height={250} alt="" style={{ flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: align }}>
          {kickerLine && <div style={{ fontSize: 26, color: "#c2441f", fontWeight: 700, marginBottom: 10 }}>{kickerLine}</div>}
          {titleLines.map((l, i) => <div key={i} style={{ fontSize: kicker ? 74 : 58, fontWeight: 700, color: "#221b16", lineHeight: 1.12 }}>{l}</div>)}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 22, alignItems: align }}>
            {subLines.map((l, i) => <div key={i} style={{ fontSize: 34, fontWeight: 400, color: "#5b5149", lineHeight: 1.3 }}>{l}</div>)}
          </div>
          <div style={{ display: "flex", marginTop: 30, background: "#e4572e", color: "#fff", fontSize: 28, fontWeight: 700, padding: "12px 28px", borderRadius: 999, border: "5px solid #221b16" }}>whatpatrikthink.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: await fonts, ...(process.env.OG_NO_EMOJI === "1" ? {} : { emoji: "twemoji" as const }), headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}
