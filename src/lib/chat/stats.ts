import type { ChatStats, Msg, AuthorStats } from "./types";

const DAY = 86_400_000;
const EMOJI = /\p{Extended_Pictographic}(?:‍\p{Extended_Pictographic})*/gu;
/** gap after which the next message counts as starting a new conversation */
const NEW_CONVO_GAP = 6 * 3_600_000;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function topN(map: Map<string, number>, n: number) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

const STOP = new Set(("the a an and or but to of in on at for is it i you he she we they me my your that this was are be with so ok okay yes no lol haha " +
  "את של על עם זה זו אני אתה את הוא היא אנחנו הם לא כן מה גם רק אבל או כי אם יש אין עוד כבר אז פה שם " +
  "и в на не что я ты он она мы с а но это да нет de la le les et un une des je tu il elle que y el los las en es lo").split(" "));
const normText = (s: string) => s.toLowerCase().replace(/https?:\S+/g, "").replace(/[^\p{L}\p{N}\p{Extended_Pictographic}\s]/gu, " ").replace(/\s+/g, " ").trim();

/** Exact counts of repeated short messages and recurring 3-word phrases. */
export function topPhrases(msgs: Msg[], limit = 15) {
  const whole = new Map<string, Map<string, number>>();
  const tri = new Map<string, Map<string, number>>();
  const bump = (m: Map<string, Map<string, number>>, k: string, a: string) => {
    let inner = m.get(k); if (!inner) { inner = new Map(); m.set(k, inner); }
    inner.set(a, (inner.get(a) ?? 0) + 1);
  };
  for (const m of msgs) {
    if (m.k && m.k !== "text") continue;
    const n = normText(m.x);
    if (!n) continue;
    const words = n.split(" ");
    if (words.length >= 2 && words.length <= 6) bump(whole, n, m.a);
    const seen = new Set<string>();
    for (let i = 0; i + 3 <= words.length && i < 40; i++) {
      const g = words.slice(i, i + 3);
      if (g.every((w) => STOP.has(w))) continue;
      const k = g.join(" ");
      if (!seen.has(k)) { seen.add(k); bump(tri, k, m.a); }
    }
  }
  const rows: { text: string; count: number; topAuthor: string; topAuthorCount: number }[] = [];
  const push = (m: Map<string, Map<string, number>>) => {
    for (const [text, by] of m) {
      let count = 0, top = "", topN = 0;
      for (const [a, c] of by) { count += c; if (c > topN) { top = a; topN = c; } }
      if (count >= 5) rows.push({ text, count, topAuthor: top, topAuthorCount: topN });
    }
  };
  push(whole); push(tri);
  rows.sort((a, b) => b.count - a.count);
  const out: typeof rows = [];
  for (const r of rows) {
    // drop near-duplicates (a trigram contained in an already kept phrase with a similar count)
    if (out.some((o) => (o.text.includes(r.text) || r.text.includes(o.text)) && Math.abs(o.count - r.count) <= o.count * 0.3)) continue;
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

export function computeStats(all: Msg[]): ChatStats {
  const msgs = all.filter((m) => m.k !== "system" && m.a);
  const total = msgs.length;
  const firstAt = msgs[0]?.t ?? null;
  const lastAt = msgs[msgs.length - 1]?.t ?? null;
  const days = firstAt != null && lastAt != null ? Math.max(1, Math.round((lastAt - firstAt) / DAY) + 1) : 0;

  const per = new Map<string, {
    messages: number; words: number; initiations: number; replies: number[]; afterMidnight: number;
    voice: number; media: number; emojis: Map<string, number>;
  }>();
  const get = (a: string) => {
    let s = per.get(a);
    if (!s) {
      s = { messages: 0, words: 0, initiations: 0, replies: [], afterMidnight: 0, voice: 0, media: 0, emojis: new Map() };
      per.set(a, s);
    }
    return s;
  };

  const hours = new Array(24).fill(0);
  const emojis = new Map<string, number>();
  const monthly = new Map<string, number>();
  let voice = 0, media = 0, afterMidnight = 0, initiationsTotal = 0;
  let longestGap = 0, longestGapEnd: number | null = null;

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const prev = msgs[i - 1];
    const s = get(m.a);
    s.messages++;
    const d = new Date(m.t);
    const h = d.getUTCHours();
    hours[h]++;
    const mk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthly.set(mk, (monthly.get(mk) ?? 0) + 1);
    if (h < 5) { s.afterMidnight++; afterMidnight++; }
    if (m.k === "voice") { s.voice++; voice++; }
    else if (m.k === "media" || m.k === "sticker") { s.media++; media++; }
    else {
      s.words += m.x.split(/\s+/).filter(Boolean).length;
      for (const e of m.x.match(EMOJI) ?? []) {
        emojis.set(e, (emojis.get(e) ?? 0) + 1);
        s.emojis.set(e, (s.emojis.get(e) ?? 0) + 1);
      }
    }
    if (!prev || m.t - prev.t >= NEW_CONVO_GAP) { s.initiations++; initiationsTotal++; }
    else if (prev.a !== m.a && m.t - prev.t < 12 * 3_600_000) s.replies.push((m.t - prev.t) / 60_000);
    if (prev) {
      const gap = m.t - prev.t;
      if (gap > longestGap) { longestGap = gap; longestGapEnd = m.t; }
    }
  }

  const authors: AuthorStats[] = [...per.entries()]
    .sort((a, b) => b[1].messages - a[1].messages)
    .map(([name, s]) => ({
      name,
      messages: s.messages,
      share: total ? s.messages / total : 0,
      words: s.words,
      initiations: s.initiations,
      initiationShare: initiationsTotal ? s.initiations / initiationsTotal : 0,
      medianReplyMinutes: median(s.replies),
      afterMidnight: s.afterMidnight,
      voice: s.voice,
      media: s.media,
      topEmojis: topN(s.emojis, 3),
    }));

  const busiest = hours.indexOf(Math.max(...hours));
  return {
    total,
    days,
    perDay: days ? Math.round((total / days) * 10) / 10 : 0,
    firstAt,
    lastAt,
    busiestHour: total ? busiest : null,
    afterMidnightShare: total ? afterMidnight / total : 0,
    voice,
    media,
    topEmojis: topN(emojis, 3),
    longestSilenceDays: Math.floor(longestGap / DAY),
    longestSilenceEndedAt: longestGapEnd,
    authors,
    monthly: [...monthly.entries()].sort().map(([month, count]) => ({ month, count })),
    phrases: topPhrases(msgs),
  };
}

/**
 * Compact transcript for the model, newest messages kept when over budget.
 * Returns the transcript plus the cut-off date if anything was dropped.
 */
export function buildTranscript(all: Msg[], charBudget: number, meName?: string | null) {
  const lines: string[] = [];
  let used = 0;
  let cutoff: number | null = null;
  let lastDay = "";
  const msgs = all.filter((m) => m.k !== "system" || m.x.length < 200);
  // walk backwards to keep the most recent part
  const kept: Msg[] = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const cost = m.a.length + m.x.length + 10;
    if (used + cost > charBudget) { cutoff = msgs[i + 1]?.t ?? m.t; break; }
    used += cost;
    kept.push(m);
  }
  kept.reverse();
  for (const m of kept) {
    const d = new Date(m.t);
    const day = d.toISOString().slice(0, 10);
    if (day !== lastDay) { lines.push(`## ${day}`); lastDay = day; }
    const hm = d.toISOString().slice(11, 16);
    const who = m.a ? (meName && m.a === meName ? `${m.a} (ME)` : m.a) : "SYSTEM";
    const body = m.k && m.k !== "text" && m.k !== "link" ? `[${m.k}] ${m.k === "media" ? "" : m.x}`.trim() : m.x;
    lines.push(`${hm} ${who}: ${body.replace(/\n/g, " / ")}`);
  }
  return { transcript: lines.join("\n"), cutoff, keptCount: kept.length };
}
