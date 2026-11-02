import { supabaseAdmin } from "@/lib/supabase/server";
import { ok, bad } from "@/lib/server/http";
import { verifyWebhook } from "@/lib/billing/paddle";
import { grant, claw, unlockReport } from "@/lib/server/credits";

export const maxDuration = 300;

/**
 * Paddle notifications. Subscribe the destination to: transaction.completed, adjustment.created, adjustment.updated.
 *
 * transaction.completed → the purchase is looked up in `payments` (written server-side at checkout — custom_data
 *   from the client is never trusted), amount + currency must match, credits are granted once (unique ledger reason),
 *   and the report it was bought from is unlocked. Safe to redeliver: every step is idempotent.
 * approved refund / chargeback adjustment → claw back the matching share of the credits that are still unspent.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("paddle-signature"))) return bad("bad_signature", 401);
  const ev = JSON.parse(raw) as { event_type: string; data: Record<string, unknown> };
  const db = supabaseAdmin();

  if (ev.event_type === "transaction.completed") {
    const d = ev.data as { id: string; currency_code?: string; details?: { totals?: { grand_total?: string } } };
    const { data: pay, error } = await db.from("payments").select("*").eq("id", d.id).maybeSingle();
    if (error) return bad("db_error", 500); // Paddle retries
    if (!pay) { console.error("paddle: unknown transaction", d.id); return ok({ ignored: "unknown transaction" }); }
    const paid = Number(d.details?.totals?.grand_total ?? -1);
    if (paid !== Number(pay.amount_minor) || (d.currency_code ?? "") !== pay.currency) {
      console.error("paddle: amount mismatch", d.id, paid, d.currency_code, pay.amount_minor, pay.currency);
      await db.from("payments").update({ status: "mismatch" }).eq("id", d.id);
      return ok({ ignored: "amount mismatch" });
    }
    await grant(pay.user_id, pay.credits, `payment:${d.id}`, pay.report_id);
    if (pay.status !== "completed") {
      const { error: e2 } = await db.from("payments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", d.id);
      if (e2) return bad("db_error", 500);
    }
    if (pay.discount === "half" && pay.report_id) {
      await db.from("offers").update({ used_at: new Date().toISOString() }).eq("report_id", pay.report_id).eq("kind", "half");
    }
    // Every delivery retries the unlock — it is a no-op once done ("already") and keeps the credit if the chat is gone.
    const unlock = pay.report_id ? await unlockReport(pay.user_id, pay.report_id) : null;
    return ok({ credits: pay.credits, unlock });
  }

  if (ev.event_type === "adjustment.created" || ev.event_type === "adjustment.updated") {
    const a = ev.data as { id: string; action: string; status: string; type?: string; transaction_id: string; totals?: { total?: string } };
    if ((a.action !== "refund" && a.action !== "chargeback") || a.status !== "approved") return ok({ ignored: `${a.action}:${a.status}` });
    const { data: pay } = await db.from("payments").select("user_id, credits, amount_minor").eq("id", a.transaction_id).maybeSingle();
    if (!pay) return ok({ ignored: "unknown transaction" });
    const share = a.type === "partial" && a.totals?.total && Number(pay.amount_minor) > 0
      ? Math.min(1, Number(a.totals.total) / Number(pay.amount_minor)) : 1;
    const credits = Math.max(1, Math.round(pay.credits * share));
    const n = await claw(pay.user_id, credits, `refund:${a.id}`);
    await db.from("payments").update({ status: a.type === "partial" ? "partially_refunded" : a.action === "chargeback" ? "chargeback" : "refunded" }).eq("id", a.transaction_id);
    return ok({ clawed: n });
  }
  return ok({ ignored: ev.event_type });
}
