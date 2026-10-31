import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function balance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin().from("credit_ledger").select("delta").eq("user_id", userId);
  return (data ?? []).reduce((s, r) => s + (r.delta as number), 0);
}

/** Atomically-enough spend one credit; returns false if none left. */
export async function spend(userId: string, reason: string, reportId?: string) {
  if ((await balance(userId)) < 1) return false;
  await supabaseAdmin().from("credit_ledger").insert({ user_id: userId, delta: -1, reason, report_id: reportId ?? null });
  return true;
}
