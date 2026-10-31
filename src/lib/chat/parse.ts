import type { Msg, MsgKind, ParsedChat } from "./types";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const INVISIBLE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
const clean = (s: string) => s.replace(INVISIBLE, "").replace(/\u202f|\u00a0/g, " ");

const MEDIA_HINTS = [
  "omitted", "media omitted", "הושמט", "הושמטה", "weggelassen", "omitida", "omitido", "omis",
  "omesso", "omessa", "ommesso", "weggelaten", "pominięt", "опущен", "пропущен", "atlandı",
  "dihilangkan", "bị bỏ qua", "省略", "생략", "تم حذف", "محذوف", "ละไว้", "छोड़ा",
];
const DELETED_HINTS = [
  "this message was deleted", "you deleted this message", "הודעה זו נמחקה", "מחקת הודעה זו",
  "diese nachricht wurde gelöscht", "se eliminó este mensaje", "ce message a été supprimé",
  "questo messaggio è stato eliminato", "это сообщение удалено", "bu mesaj silindi",
];

function kindOf(text: string): MsgKind | undefined {
  const l = text.toLowerCase().trim();
  if (!l) return "media";
  if (DELETED_HINTS.some((h) => l.includes(h))) return "deleted";
  if (/\.(opus|m4a|aac|ogg)\b/.test(l) || /audio omitted|ptt-|הקלטה הושמטה|שמע הושמט/.test(l)) return "voice";
  if (/sticker omitted|מדבקה הושמטה/.test(l)) return "sticker";
  if (l.length < 80 && (MEDIA_HINTS.some((h) => l.includes(h)) || /^<[^>]{2,40}>$/.test(l) ||
      /\.(jpg|jpeg|png|webp|mp4|mov|pdf|vcf|gif)\b.*\((file attached|קובץ מצורף)\)/.test(l))) return "media";
  if (/^https?:\/\/\S+$/.test(l)) return "link";
  return undefined;
}

function to24(h: number, ampm?: string): number {
  if (!ampm) return h;
  const a = ampm.toLowerCase().replace(/\./g, "");
  const pm = /^(pm|p|오후|午後|下午|ب\.ظ|م)$/.test(a) || a.startsWith("p");
  const am = /^(am|a|오전|午前|上午|ق\.ظ|ص)$/.test(a) || a.startsWith("a");
  if (pm && h < 12) return h + 12;
  if (am && h === 12) return 0;
  return h;
}

function mk(y: number, mo: number, d: number, h: number, mi: number, s = 0): number {
  if (y < 100) y += 2000;
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

/* ------------------------------------------------------------------ */
/* WhatsApp (Android + iOS, all common locales)                        */
/* ------------------------------------------------------------------ */

// [31/12/2025, 21:15:03] Name: text      (iOS)
// 31/12/2025, 21:15 - Name: text         (Android)
// 12/31/25, 9:15 PM - Name: text
// 31.12.25, 21:15 - Name: text
// 2025-12-31, 21:15 - Name: text
const WA_LINE =
  /^\[?(\d{1,4})[./\-](\d{1,2})[./\-](\d{1,4})[,\s]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?|午前|午後|오전|오후|上午|下午)?\]?\s*(?:-|–|:)?\s*(.*)$/;

interface RawWa { p1: number; p2: number; p3: number; h: number; mi: number; s: number; ampm?: string; rest: string }

export function looksLikeWhatsApp(text: string): boolean {
  const lines = text.split(/\r?\n/).slice(0, 40).map(clean);
  return lines.filter((l) => WA_LINE.test(l) && /:\s/.test(l.split(/\]|-\s/).slice(1).join(" "))).length >= 2;
}

export function parseWhatsApp(input: string): ParsedChat {
  const lines = input.split(/\r?\n/);
  const raws: RawWa[] = [];
  for (const rawLine of lines) {
    const line = clean(rawLine);
    const m = WA_LINE.exec(line);
    if (m) {
      raws.push({
        p1: +m[1], p2: +m[2], p3: +m[3], h: +m[4], mi: +m[5], s: m[6] ? +m[6] : 0,
        ampm: m[7], rest: m[8] ?? "",
      });
    } else if (raws.length) {
      raws[raws.length - 1].rest += "\n" + line;
    }
  }

  // decide date order
  let order: "ymd" | "dmy" | "mdy" = "dmy";
  if (raws.some((r) => r.p1 > 31)) order = "ymd";
  else if (raws.some((r) => r.p1 > 12)) order = "dmy";
  else if (raws.some((r) => r.p2 > 12)) order = "mdy";
  else if (raws.some((r) => r.ampm)) order = "mdy";

  const messages: Msg[] = [];
  const authors = new Map<string, number>();
  for (const r of raws) {
    const [y, mo, d] =
      order === "ymd" ? [r.p1, r.p2, r.p3] : order === "dmy" ? [r.p3, r.p2, r.p1] : [r.p3, r.p1, r.p2];
    const t = mk(y, mo, d, to24(r.h, r.ampm), r.mi, r.s);
    if (Number.isNaN(t)) continue;
    const rest = r.rest.trim();
    const sep = rest.indexOf(": ");
    // system lines have no "Name: " prefix (or the prefix is absurdly long)
    if (sep <= 0 || sep > 60) {
      messages.push({ t, a: "", x: rest, k: "system" });
      continue;
    }
    const a = rest.slice(0, sep).trim();
    const x = rest.slice(sep + 2).trim();
    const k = kindOf(x);
    messages.push(k ? { t, a, x, k } : { t, a, x });
    authors.set(a, (authors.get(a) ?? 0) + 1);
  }
  return {
    source: "whatsapp",
    title: null,
    participants: [...authors.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n),
    messages,
  };
}

/* ------------------------------------------------------------------ */
/* LINE                                                                */
/* ------------------------------------------------------------------ */

const LINE_DATE = /^(?:\w{2,4},?\s*)?(\d{4})[./](\d{1,2})[./](\d{1,2})(?:\s*\(.+\))?\s*$|^(?:\w{3},\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/;
const LINE_MSG = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\t([^\t]+)\t(.*)$/;

export function looksLikeLine(text: string): boolean {
  return /^\[LINE\]/m.test(text.slice(0, 500)) || text.split("\n").slice(0, 60).filter((l) => LINE_MSG.test(clean(l))).length >= 3;
}

export function parseLine(input: string): ParsedChat {
  const messages: Msg[] = [];
  const authors = new Map<string, number>();
  let day: [number, number, number] | null = null;
  let title: string | null = null;
  for (const raw of input.split(/\r?\n/)) {
    const line = clean(raw);
    if (!title) {
      const tm = /^\[LINE\]\s*(?:Chat history (?:in|with)\s*)?(.+)$/.exec(line);
      if (tm) { title = tm[1].trim(); continue; }
    }
    const dm = LINE_DATE.exec(line.trim());
    if (dm) {
      day = dm[1] ? [+dm[1], +dm[2], +dm[3]] : [+dm[6], +dm[4], +dm[5]];
      continue;
    }
    const mm = LINE_MSG.exec(line);
    if (mm && day) {
      const t = mk(day[0], day[1], day[2], to24(+mm[1], mm[3]), +mm[2]);
      const a = mm[4].trim();
      let x = mm[5].trim().replace(/^"|"$/g, "");
      const k = /^\[(photo|video|sticker|file|voice message|写真|動画|スタンプ|사진|동영상|이모티콘)\]$/i.test(x)
        ? (/voice/i.test(x) ? "voice" : /sticker|スタンプ|이모티콘/i.test(x) ? "sticker" : "media")
        : kindOf(x);
      if (k === "media" && !x) x = "[media]";
      messages.push(k ? { t, a, x, k } : { t, a, x });
      authors.set(a, (authors.get(a) ?? 0) + 1);
    } else if (messages.length && line.trim() && !dm) {
      messages[messages.length - 1].x += "\n" + line;
    }
  }
  return { source: "line", title, participants: rank(authors), messages };
}

/* ------------------------------------------------------------------ */
/* KakaoTalk                                                           */
/* ------------------------------------------------------------------ */

// mobile: 2025년 12월 31일 오후 9:15, 이름 : 내용
const KAKAO_MOBILE_KO = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s:\s(.*)$/;
// mobile (dots): 2025. 12. 31. 오후 9:15, 이름 : 내용
const KAKAO_MOBILE_DOT = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후|AM|PM)?\s*(\d{1,2}):(\d{2}),\s*(.+?)\s:\s(.*)$/;
// mobile (en): December 31, 2025 at 9:15 PM, Name : text
const KAKAO_MOBILE_EN = /^([A-Z][a-z]+)\s(\d{1,2}),\s(\d{4})\sat\s(\d{1,2}):(\d{2})\s?(AM|PM),\s(.+?)\s:\s(.*)$/;
// pc: --------------- 2025년 12월 31일 수요일 ---------------
const KAKAO_PC_DATE = /^-{5,}\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*-{5,}$|^-{5,}\s*\w+,\s*([A-Z][a-z]+)\s(\d{1,2}),\s(\d{4})\s*-{5,}$/;
// pc: [이름] [오후 9:15] 내용
const KAKAO_PC_MSG = /^\[(.+?)\]\s\[(오전|오후|AM|PM)\s(\d{1,2}):(\d{2})\]\s(.*)$/;
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

export function looksLikeKakao(text: string): boolean {
  const head = text.split("\n").slice(0, 80).map(clean);
  return head.some((l) => /KakaoTalk|카카오톡/.test(l)) ||
    head.filter((l) => KAKAO_MOBILE_KO.test(l) || KAKAO_MOBILE_DOT.test(l) || KAKAO_MOBILE_EN.test(l) || KAKAO_PC_MSG.test(l)).length >= 3;
}

export function parseKakao(input: string): ParsedChat {
  const messages: Msg[] = [];
  const authors = new Map<string, number>();
  let day: [number, number, number] | null = null;
  let title: string | null = null;
  const push = (t: number, a: string, x: string) => {
    const k = /^(사진|동영상|이모티콘|Photo|Video|Emoticons?)$/i.test(x.trim()) ? "media" : kindOf(x);
    messages.push(k ? { t, a, x, k } : { t, a, x });
    authors.set(a, (authors.get(a) ?? 0) + 1);
  };
  for (const raw of input.split(/\r?\n/)) {
    const line = clean(raw).trimEnd();
    if (!title) {
      const tm = /^(.+?)\s*(?:님과 카카오톡 대화|KakaoTalk Chats with)\s*(.*)$/.exec(line);
      if (tm) { title = (tm[2] || tm[1]).trim(); continue; }
    }
    let m: RegExpExecArray | null;
    if ((m = KAKAO_MOBILE_KO.exec(line))) { push(mk(+m[1], +m[2], +m[3], to24(+m[5], m[4]), +m[6]), m[7].trim(), m[8]); continue; }
    if ((m = KAKAO_MOBILE_DOT.exec(line))) { push(mk(+m[1], +m[2], +m[3], to24(+m[5], m[4]), +m[6]), m[7].trim(), m[8]); continue; }
    if ((m = KAKAO_MOBILE_EN.exec(line))) {
      push(mk(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2], to24(+m[4], m[6]), +m[5]), m[7].trim(), m[8]);
      continue;
    }
    if ((m = KAKAO_PC_DATE.exec(line))) {
      day = m[1] ? [+m[1], +m[2], +m[3]] : [+m[6], MONTHS.indexOf(m[4].toLowerCase()) + 1, +m[5]];
      continue;
    }
    if ((m = KAKAO_PC_MSG.exec(line)) && day) { push(mk(day[0], day[1], day[2], to24(+m[3], m[2]), +m[4]), m[1].trim(), m[5]); continue; }
    if (messages.length && line && !/^(저장한 날짜|Date Saved)/.test(line) && !/^\d{4}년 \d{1,2}월 \d{1,2}일 (오전|오후) \d{1,2}:\d{2}$/.test(line)) {
      messages[messages.length - 1].x += "\n" + line;
    }
  }
  return { source: "kakaotalk", title, participants: rank(authors), messages };
}

/* ------------------------------------------------------------------ */
/* Telegram Desktop JSON export (result.json)                          */
/* ------------------------------------------------------------------ */

type TgText = string | { text: string } | Array<string | { text: string }>;
const tgText = (t: TgText): string =>
  typeof t === "string" ? t : Array.isArray(t) ? t.map((p) => (typeof p === "string" ? p : p.text)).join("") : t.text;

export function parseTelegram(json: unknown): ParsedChat {
  const root = json as { name?: string; messages?: Array<Record<string, unknown>>; chats?: { list?: Array<{ name?: string; messages?: Array<Record<string, unknown>> }> } };
  const chat = root.messages ? root : root.chats?.list?.[0] ?? { messages: [] };
  const authors = new Map<string, number>();
  const messages: Msg[] = [];
  for (const m of chat.messages ?? []) {
    if (m.type !== "message") continue;
    const date = String(m.date ?? "");
    const dm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(date);
    if (!dm) continue;
    const t = mk(+dm[1], +dm[2], +dm[3], +dm[4], +dm[5], +dm[6]);
    const a = String(m.from ?? "");
    let x = tgText((m.text ?? "") as TgText);
    let k: MsgKind | undefined;
    if (m.media_type === "voice_message" || m.media_type === "audio_file") k = "voice";
    else if (m.media_type === "sticker") k = "sticker";
    else if (m.photo || m.media_type || m.file) k = "media";
    if (!x && k) x = `[${k}]`;
    messages.push(k ? { t, a, x, k } : { t, a, x });
    authors.set(a, (authors.get(a) ?? 0) + 1);
  }
  return { source: "telegram", title: (chat as { name?: string }).name ?? null, participants: rank(authors), messages };
}

/* ------------------------------------------------------------------ */
/* Generic CSV (iMessage exporters, Instagram converters etc.)        */
/* ------------------------------------------------------------------ */

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function csvRows(text: string): string[][] {
  // handle quoted newlines
  const rows: string[] = [];
  let buf = "";
  for (const line of text.split(/\r?\n/)) {
    buf = buf ? buf + "\n" + line : line;
    if ((buf.match(/"/g)?.length ?? 0) % 2 === 0) { rows.push(buf); buf = ""; }
  }
  return rows.filter(Boolean).map(splitCsv);
}

export function parseCsv(text: string, source = "imessage"): ParsedChat {
  const rows = csvRows(text);
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iT = col("date", "time", "timestamp");
  const iA = col("sender", "from", "author", "name", "handle");
  const iX = col("text", "message", "body", "content");
  const iMe = col("is_from_me", "is from me", "from me");
  if (iT < 0 || iX < 0) throw new Error("csv_unrecognized");
  const authors = new Map<string, number>();
  const messages: Msg[] = [];
  for (const r of rows.slice(1)) {
    const t = Date.parse((r[iT] ?? "").replace(" ", "T") + (/[zZ+]/.test(r[iT] ?? "") ? "" : "Z"));
    if (Number.isNaN(t)) continue;
    let a = iA >= 0 ? (r[iA] ?? "").trim() : "";
    if (iMe >= 0 && /^(1|true|yes)$/i.test((r[iMe] ?? "").trim())) a = "Me";
    if (!a) a = "Unknown";
    const x = (r[iX] ?? "").trim();
    const k = kindOf(x);
    messages.push(k ? { t, a, x, k } : { t, a, x });
    authors.set(a, (authors.get(a) ?? 0) + 1);
  }
  messages.sort((a, b) => a.t - b.t);
  return { source, title: null, participants: rank(authors), messages };
}

/* ------------------------------------------------------------------ */
/* iMessage Exporter (reagentx/imessage-exporter) .txt                 */
/* ------------------------------------------------------------------ */

// Dec 31, 2025  9:15:03 PM (Read by them after 2 minutes)
const IMX_TIME = /^([A-Z][a-z]{2})\s(\d{1,2}),\s(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s(AM|PM)/;
const MON3 = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

export function looksLikeImessageExporter(text: string): boolean {
  return text.split("\n").slice(0, 60).filter((l) => IMX_TIME.test(l)).length >= 2;
}

export function parseImessageExporter(text: string): ParsedChat {
  const blocks = text.split(/\r?\n\r?\n/);
  const authors = new Map<string, number>();
  const messages: Msg[] = [];
  for (const b of blocks) {
    const lines = b.split(/\r?\n/);
    const m = IMX_TIME.exec(lines[0] ?? "");
    if (!m || lines.length < 3) continue;
    const t = mk(+m[3], MON3.indexOf(m[1].toLowerCase()) + 1, +m[2], to24(+m[4], m[7]), +m[5], +m[6]);
    const a = lines[1].trim();
    const x = lines.slice(2).join("\n").trim();
    const k = kindOf(x);
    messages.push(k ? { t, a, x, k } : { t, a, x });
    authors.set(a, (authors.get(a) ?? 0) + 1);
  }
  return { source: "imessage", title: null, participants: rank(authors), messages };
}

/* ------------------------------------------------------------------ */
/* dispatcher                                                          */
/* ------------------------------------------------------------------ */

function rank(m: Map<string, number>) {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

export class ParseError extends Error {}

/** Parse the text content of an export. */
export function parseText(text: string, hint?: string): ParsedChat {
  const t = text.replace(/^\ufeff/, "");
  const trimmed = t.trimStart();
  if (trimmed.startsWith("{")) {
    try { return parseTelegram(JSON.parse(trimmed)); } catch { /* fall through */ }
  }
  const tryAll: Array<[boolean, () => ParsedChat]> = [
    [hint === "kakaotalk" || looksLikeKakao(t), () => parseKakao(t)],
    [hint === "line" || looksLikeLine(t), () => parseLine(t)],
    [looksLikeWhatsApp(t), () => parseWhatsApp(t)],
    [looksLikeImessageExporter(t), () => parseImessageExporter(t)],
    [/^[^\n]*(date|time|timestamp)[^\n]*,[^\n]*(text|message|body)/i.test(t.slice(0, 400)), () => parseCsv(t, hint ?? "imessage")],
  ];
  for (const [ok, fn] of tryAll) {
    if (!ok) continue;
    const r = fn();
    if (r.messages.filter((m) => m.k !== "system").length >= 2) {
      if (hint && r.source === "whatsapp" && hint !== "whatsapp") r.source = hint;
      return r;
    }
  }
  throw new ParseError("unrecognized_format");
}
