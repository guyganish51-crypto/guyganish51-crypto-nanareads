import { supabaseAdmin } from "@/lib/supabase/server";
import { ok, bad } from "@/lib/server/http";
import { emailDict, layout, list, esc, sendEmail } from "@/lib/email/send";
import { fmt } from "@/lib/fmt";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 120;
const H = 3_600_000;

/**
 * Hourly. Funnel per report:
 *  preview_ready → "previewReady" immediately
 *  not unlocked +3h → "nudge" (locked section list)
 *  not unlocked +27h → "hook" (AI-written subject from the chat)
 *  full_ready → "fullReady"; +76h → "next" (cross-sell another chat)
 * Stops as soon as the user unlocks. Each kind is sent at most once per report.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return bad("unauthorized", 401);
  if (!process.env.RESEND_API_KEY) return ok({ skipped: "no RESEND_API_KEY" });
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 6 * 24 * H).toISOString();
  const { data: reps } = await db.from("reports")
    .select("id, user_id, status, unlocked, lang, title, preview, created_at, updated_at, full_ready_at, number")
    .gte("created_at", since).in("status", ["preview_ready", "full_ready"]).limit(2000);
  if (!reps?.length) return ok({ sent: 0 });
  const ids = reps.map((r) => r.id);
  const { data: logs } = await db.from("email_log").select("report_id, kind").in("report_id", ids);
  const done = new Set((logs ?? []).map((l) => `${l.report_id}:${l.kind}`));
  const { data: outs } = await db.from("email_optout").select("user_id");
  const optedOut = new Set((outs ?? []).map((o) => o.user_id));
  const emails = new Map<string, string>();
  let sent = 0;

  for (const r of reps) {
    const now = Date.now();
    const age = now - new Date(r.updated_at).getTime();
    let kind: string | null = null;
    if (r.status === "preview_ready" && !r.unlocked && r.number === 1) {
      if (!done.has(`${r.id}:previewReady`)) kind = "previewReady";
      else if (age > 3 * H && !done.has(`${r.id}:nudge`)) kind = "nudge";
      else if (age > 27 * H && !done.has(`${r.id}:hook`)) kind = "hook";
    } else if (r.status === "full_ready") {
      const fullAge = now - new Date(r.full_ready_at ?? r.updated_at).getTime();
      if (!done.has(`${r.id}:fullReady`) && fullAge < 24 * H) kind = "fullReady";
      else if (r.number === 1 && fullAge > 76 * H && !done.has(`${r.id}:next`)) kind = "next";
    }
    if (!kind) continue;
    const marketing = kind === "nudge" || kind === "hook" || kind === "next";
    if (marketing && optedOut.has(r.user_id)) continue;
    let to = emails.get(r.user_id);
    if (!to) {
      const { data } = await db.auth.admin.getUserById(r.user_id);
      to = data.user?.email ?? "";
      emails.set(r.user_id, to);
    }
    if (!to) continue;
    const d = await emailDict(r.lang);
    const url = `${SITE_URL}/${r.lang}/r/${r.id}?email=${kind}`;
    const title = r.title ?? "";
    const p = r.preview as { people?: { name: string; title: string }[]; sections?: { emoji: string; heading: string }[]; email_hook?: string } | null;
    const people = (p?.people ?? []).slice(0, 3).map((x) => `${x.name} — ${x.title}`);
    let subject = "", html = "";
    const base = { lang: r.lang, d, userId: r.user_id };
    if (kind === "previewReady") {
      subject = d.previewReady.subject;
      html = layout({ ...base, pre: fmt(d.previewReady.pre, { names: people.join(" · ") }), h: d.previewReady.h, body: `<b>${esc(title)}</b><br>${esc(d.previewReady.body)}${list([...people, d.previewReady.more])}`, cta: { label: d.previewReady.cta, url } });
    } else if (kind === "nudge") {
      subject = fmt(d.nudge.subject, { title });
      html = layout({ ...base, pre: d.nudge.pre, h: d.nudge.h, body: `${esc(d.nudge.body)}${list((p?.sections ?? []).map((s) => `${s.emoji} ${s.heading}`))}<p>${esc(d.nudge.credit)}</p>`, cta: { label: d.nudge.cta, url } });
    } else if (kind === "hook") {
      subject = p?.email_hook || title;
      html = layout({ ...base, pre: d.hook.pre, h: d.hook.h, body: esc(fmt(d.hook.body, { title })), cta: { label: d.hook.cta, url }, ps: d.hook.ps });
    } else if (kind === "fullReady") {
      subject = d.fullReady.subject;
      html = layout({ ...base, pre: fmt(d.fullReady.pre, { title }), h: d.fullReady.h, body: `<b>${esc(title)}</b>`, cta: { label: d.fullReady.cta, url }, ps: d.fullReady.ps });
    } else {
      subject = d.next.subject;
      html = layout({ ...base, pre: d.next.pre, h: d.next.h, body: esc(d.next.body), cta: { label: d.next.cta, url: `${SITE_URL}/${r.lang}/start?from=email_next` } });
    }
    if (await sendEmail(to, subject, html, marketing ? "marketing" : "transactional")) {
      await db.from("email_log").insert({ user_id: r.user_id, report_id: r.id, kind });
      sent++;
    }
  }
  return ok({ sent });
}
