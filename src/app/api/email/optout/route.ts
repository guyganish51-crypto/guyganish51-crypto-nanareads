import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { ok, bad } from "@/lib/server/http";

/** Opt out of marketing email (reminders/offers) at signup — the soft opt-in "refuse" choice. */
export async function POST() {
  const user = await currentUser();
  if (!user) return bad("auth_required", 401);
  await supabaseAdmin().from("email_optout").upsert({ user_id: user.id });
  return ok({ ok: true });
}
