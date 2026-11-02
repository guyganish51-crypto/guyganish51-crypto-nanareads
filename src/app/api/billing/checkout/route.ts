import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { ok, bad, body } from "@/lib/server/http";
import { isPack, creditsOf, currencyFor, priceOf, type PackId } from "@/lib/billing/pricing";
import { activeOffer } from "@/lib/billing/offer";
import { createTransaction, paddleConfigured } from "@/lib/billing/paddle";
import { chatAlive } from "@/lib/server/credits";

const NAMES: Record<PackId, string> = { single: "1 report", trio: "3 reports", ten: "10 reports" };

/** Creates a Paddle transaction (price locked server-side) and returns its id for Paddle.js. */
export async function POST(req: Request) {
  if (!paddleConfigured()) return bad("payments_unavailable", 503);
  const user = await currentUser();
  if (!user) return bad("auth_required", 401);
  const b = await body<{ pack?: string; reportId?: string; source?: string }>(req);
  if (!b || !isPack(b.pack)) return bad("bad_pack");
  const pack = b.pack;
  let reportId: string | null = null;
  let reportCurrency: string | null = null;
  if (b.reportId) {
    const { data: rep } = await supabaseAdmin().from("reports").select("id, user_id, unlocked, chat_id, currency").eq("id", b.reportId).maybeSingle();
    if (!rep || rep.user_id !== user.id) return bad("not_found", 404);
    if (rep.unlocked) return bad("already_unlocked", 409);
    if (!(await chatAlive(rep.chat_id))) return bad("chat_gone", 410);
    reportId = rep.id;
    reportCurrency = rep.currency;
  }
  const country = req.headers.get("x-vercel-ip-country");
  // Same currency the report's emails quoted (set at preview time); otherwise the visitor's.
  let currency = reportCurrency ?? currencyFor(country);
  const offer = pack === "single" && user ? await activeOffer(user.id, reportId) : null;
  const half = !!offer;
  const credits = creditsOf(pack);
  const make = (cur: string) => createTransaction({
    name: `What Patrik Thinks — ${NAMES[pack]}`,
    description: `${credits} credit${credits > 1 ? "s" : ""}: each one unlocks a full report or a follow-up question.`,
    amountMinor: priceOf(cur, pack, half),
    currency: cur,
    customData: { user_id: user.id, pack, report_id: reportId ?? "", discount: half ? "half" : "", source: (b.source ?? "").slice(0, 40) },
  });
  let txn: { id: string };
  try { txn = await make(currency); }
  catch (e) {
    if (currency === "USD") { console.error(e); return bad("checkout_failed", 502); }
    currency = "USD";
    try { txn = await make(currency); } catch (e2) { console.error(e2); return bad("checkout_failed", 502); }
  }
  const { error: insErr } = await supabaseAdmin().from("payments").insert({
    id: txn.id, user_id: user.id, report_id: reportId, pack, credits, amount_minor: priceOf(currency, pack, half),
    currency, discount: half ? "half" : null, country, status: "created",
  });
  if (insErr) { console.error(insErr); return bad("db_error", 500); }
  return ok({ transactionId: txn.id, email: user.email, currency });
}
