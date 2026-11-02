import { supabaseAdmin } from "@/lib/supabase/server";
import { ok, bad } from "@/lib/server/http";
import { verifyWebhook } from "@/lib/billing/paddle";
import { grant, unlockReport } from "@/lib/server/credits";
import { isPack, creditsOf } from "@/lib/billing/pricing";

export const maxDuration = 300;

/**
 * Paddle notifications. Subscribe the destination to: transaction.completed, adjustment.created, adjustment.updated.
 * transaction.completed → grant credits (idempotent on txn id) → if bought from a report, unlock it.
 * approved refund adjustment → claw back the credits that are still unspent.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("paddle-signature"))) return bad("bad_signature", 401);
  const ev = JSON.parse(raw) as { event_type: string; data: Record<string, unknown> };
  const db = supabaseAdmin();

  if (ev.event_type === "transaction.completed") {
    const d = ev.data as { id: string; custom_data?: Record<string, string> | null; currency_code?: string; details?: { totals?: { grand_total?: string } } };
    const cd = d.custom_data ?? {};
    const userId = cd.user_id;
    if (!userId || !isPack(cd.pack)) return ok({ ignored: "no custom data" });
    const credits = creditsOf(cd.pack);
    const fresh = await grant(userId, credits, `payment:${d.id}`, cd.report_id || null);
    await db.from("payments").upsert({
      id: d.id, user_id: userId, report_id: cd.report_id || null, pack: cd.pack, credits,
      amount_minor: Number(d.details?.totals?.grand_total ?? 0), currency: d.currency_code ?? "USD",
      discount: cd.discount || null, status: "completed", completed_at: new Date().toISOString(),
    });
    if (cd.discount === "half" && cd.report_id) {
      await db.from("offers").update({ used_at: new Date().toISOString() }).eq("report_id", cd.report_id).eq("kind", "half");
    }
    if (fresh && cd.report_id) await unlockReport(userId, cd.report_id);
    return ok({ granted: fresh ? credits : 0 });
  }

  if (ev.event_type === "adjustment.created" || ev.event_type === "adjustment.updated") {
    const a = ev.data as { id: string; action: string; status: string; transaction_id: string };
    if (a.action !== "refund" || a.status !== "approved") return ok({ ignored: a.status });
    const { data: pay } = await db.from("payments").select("user_id, credits, status").eq("id", a.transaction_id).maybeSingle();
    if (!pay || pay.status === "refunded") return ok({ ignored: "unknown or done" });
    const { data: led } = await db.from("credit_ledger").select("delta").eq("user_id", pay.user_id);
    const bal = (led ?? []).reduce((s, r) => s + (r.delta as number), 0);
    const claw = Math.min(pay.credits, Math.max(0, bal));
    if (claw > 0) await grant(pay.user_id, -claw, `refund:${a.transaction_id}`);
    await db.from("payments").update({ status: "refunded" }).eq("id", a.transaction_id);
    return ok({ clawed: claw });
  }
  return ok({ ignored: ev.event_type });
}
