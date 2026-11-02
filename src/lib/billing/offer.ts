import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Active 50%-off offer for this report (created by the discount email), or null. */
export async function activeOffer(userId: string, reportId: string | null | undefined) {
  if (!reportId) return null;
  const { data } = await supabaseAdmin().from("offers").select("id, expires_at, used_at")
    .eq("user_id", userId).eq("report_id", reportId).eq("kind", "half").maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  return { id: data.id as number, expiresAt: data.expires_at as string };
}
