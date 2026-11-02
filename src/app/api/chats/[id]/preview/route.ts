import { currencyFor } from "@/lib/billing/pricing";
import { after } from "next/server";
import { supabaseAdmin, currentUser } from "@/lib/supabase/server";
import { ok, bad, body, HEATS } from "@/lib/server/http";
import { runPreview } from "@/lib/ai/generate";

export const maxDuration = 300;

/** Claim the anonymous chat for the signed-in user and start the free preview. */
export async function POST(req: Request, ctx: RouteContext<"/api/chats/[id]/preview">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return bad("auth_required", 401);
  const b = await body<{ secret: string; heat?: string }>(req);
  const db = supabaseAdmin();
  const { data: chat } = await db.from("chats").select("id, attempt_id, user_id, report_lang, stats, participants, context, message_count, me_name").eq("id", id).single();
  if (!chat) return bad("not_found", 404);
  if (chat.user_id && chat.user_id !== user.id) return bad("not_found", 404);
  if (!chat.user_id) {
    const { data: att } = await db.from("attempts").select("secret").eq("id", chat.attempt_id).single();
    if (att?.secret !== b?.secret) return bad("not_found", 404);
    await db.from("attempts").update({ user_id: user.id, status: "claimed" }).eq("id", chat.attempt_id);
    await db.from("chats").update({ user_id: user.id }).eq("id", id);
  }
  const { data: existing } = await db.from("reports").select("id").eq("chat_id", id).eq("number", 1).maybeSingle();
  if (existing) return ok({ reportId: existing.id });
  const heat = HEATS.includes(b?.heat as never) ? b!.heat : "spicy";
  const { data: rep, error } = await db.from("reports").insert({
    chat_id: id, user_id: user.id, number: 1, lang: chat.report_lang, status: "preview_pending", content: { heat }, currency: currencyFor(req.headers.get("x-vercel-ip-country")),
    snapshot: { stats: chat.stats, participants: chat.participants, context: chat.context, messageCount: chat.message_count, meName: chat.me_name },
  }).select("id").single();
  if (error || !rep) return bad("db_error", 500);
  after(() => runPreview(rep.id));
  return ok({ reportId: rep.id });
}
