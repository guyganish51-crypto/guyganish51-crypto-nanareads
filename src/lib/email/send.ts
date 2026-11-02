import "server-only";
import { createHmac } from "node:crypto";
import { SITE_URL } from "@/lib/site";
import { dirOf, isLocale } from "@/lib/i18n/config";
import en from "@/messages/emails/en.json";

export type EmailDict = typeof en;
const cache = new Map<string, EmailDict>();

export async function emailDict(locale: string): Promise<EmailDict> {
  if (cache.has(locale)) return cache.get(locale)!;
  let d: EmailDict = en;
  try {
    if (locale !== "en") d = { ...en, ...((await import(`@/messages/emails/${locale}.json`)).default as Partial<EmailDict>) };
  } catch { /* fall back to English */ }
  cache.set(locale, d);
  return d;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function unsubToken(userId: string) {
  const sig = createHmac("sha256", process.env.SUPABASE_SECRET_KEY ?? "dev").update(userId).digest("hex").slice(0, 32);
  return `${userId}.${sig}`;
}
export function checkUnsub(token: string): string | null {
  const [uid] = token.split(".");
  return uid && unsubToken(uid) === token ? uid : null;
}

export function layout(o: { lang: string; pre: string; h: string; body: string; cta?: { label: string; url: string }; ps?: string; d: EmailDict; userId: string }) {
  const dir = isLocale(o.lang) ? dirOf(o.lang) : "ltr";
  const unsub = `${SITE_URL}/api/email/unsubscribe?t=${encodeURIComponent(unsubToken(o.userId))}`;
  return `<!doctype html><html lang="${o.lang}" dir="${dir}"><body style="margin:0;background:#fbf4e9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#221b16">
<span style="display:none;max-height:0;overflow:hidden">${esc(o.pre)}</span>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border:2px solid #221b16;border-radius:18px">
<tr><td style="padding:28px 28px 8px;font-size:22px;font-weight:700">🎧 What Patrik Thinks</td></tr>
<tr><td style="padding:8px 28px;font-size:24px;font-weight:700;line-height:1.3">${esc(o.h)}</td></tr>
<tr><td style="padding:8px 28px;font-size:16px;line-height:1.6">${o.body}</td></tr>
${o.cta ? `<tr><td style="padding:18px 28px"><a href="${o.cta.url}" style="display:inline-block;background:#e4572e;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px;border:2px solid #221b16">${esc(o.cta.label)} →</a></td></tr>` : ""}
<tr><td style="padding:8px 28px 4px;font-size:16px">${esc(o.d.sign)}</td></tr>
${o.ps ? `<tr><td style="padding:8px 28px 24px;font-size:14px;color:#5b5149">${esc(o.ps)}</td></tr>` : `<tr><td style="padding:12px"></td></tr>`}
</table>
<p style="font-size:12px;color:#5b5149;margin:16px 0">${esc(o.d.footer)} · <a href="${unsub}" style="color:#5b5149">${esc(o.d.unsubscribe)}</a></p>
</td></tr></table></body></html>`;
}

export const list = (items: string[]) => `<ul style="padding-inline-start:20px;margin:8px 0">${items.map((i) => `<li style="margin:4px 0">${esc(i)}</li>`).join("")}</ul>`;
export { esc };

/** Send through Resend's HTTP API. No-op (returns false) until RESEND_API_KEY is configured. */
export async function sendEmail(to: string, subject: string, html: string, kind: "transactional" | "marketing") {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = kind === "transactional"
    ? process.env.EMAIL_FROM_TRANSACTIONAL ?? "Patrik <reports@whatpatrikthink.com>"
    : process.env.EMAIL_FROM_MARKETING ?? "Patrik <patrik@whatpatrikthink.com>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, headers: kind === "marketing" ? { "List-Unsubscribe": "<mailto:unsubscribe@whatpatrikthink.com>" } : undefined }),
  });
  return r.ok;
}
