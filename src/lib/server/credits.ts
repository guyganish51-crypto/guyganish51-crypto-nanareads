import "server-only";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { runFull } from "@/lib/ai/generate";

export async function balance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin().from("credit_ledger").select("delta").eq("user_id", userId);
  return (data ?? []).reduce((s, r) => s + (r.delta as number), 0);
}

/** Atomic spend of one credit (serialised per user in Postgres). Returns false if none left. */
export async function spend(userId: string, reason: string, reportId?: string) {
  const { data, error } = await supabaseAdmin().rpc("spend_credit", { p_user: userId, p_reason: reason, p_report: reportId ?? null });
  if (error) throw error;
  return data === true;
}

/** Add credits. `reason` must be unique for payments ("payment:txn_…") — duplicates are ignored. */
export async function grant(userId: string, delta: number, reason: string, reportId?: string | null) {
  const { error } = await supabaseAdmin().from("credit_ledger").insert({ user_id: userId, delta, reason, report_id: reportId ?? null });
  if (error && error.code !== "23505") throw error;
  return !error;
}

export type UnlockResult = "unlocked" | "already" | "no_credits" | "not_ready" | "not_found";

/** Spend a credit (unless `free`) and start writing the full report in the background. */
export async function unlockReport(userId: string, reportId: string, opts: { free?: string } = {}): Promise<UnlockResult> {
  const db = supabaseAdmin();
  const { data: rep } = await db.from("reports").select("id, user_id, status, unlocked").eq("id", reportId).maybeSingle();
  if (!rep || rep.user_id !== userId) return "not_found";
  if (rep.unlocked) return "already";
  if (rep.status !== "preview_ready") return "not_ready";
  if (opts.free && !(await grant(userId, 1, opts.free, reportId))) return "already";
  if (!(await spend(userId, "unlock", reportId))) return "no_credits";
  const { data: upd } = await db.from("reports").update({ unlocked: true, status: "full_pending" })
    .eq("id", reportId).eq("unlocked", false).select("id");
  if (!upd?.length) { await grant(userId, 1, "refund:race", reportId); return "already"; }
  after(() => runFull(reportId));
  return "unlocked";
}
