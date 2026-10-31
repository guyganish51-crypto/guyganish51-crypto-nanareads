import { after } from "next/server";
import { supabaseAdmin, currentUser } from "@/lib/supabase/server";
import { ok, bad, body, HEATS } from "@/lib/server/http";
import { spend } from "@/lib/server/credits";
import { runFull } from "@/lib/ai/generate";

export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/chats/[id]/followup">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return bad("auth_required", 401);
  const b = await body<{ question: string; heat?: string; lang?: string }>(req);
  const q = b?.question?.trim();
  if (!q || q.length < 5) return bad("question_too_short");
  const db = supabaseAdmin();
  const { data: chat } = await db.from("chats").select("id, user_id, report_lang, stats, participants, context, message_count, me_name, storage_path").eq("id", id).single();
  if (!chat || chat.user_id !== user.id) return bad("not_found", 404);
  if (!chat.storage_path) return bad("chat_expired", 410);
  const { data: last } = await db.from("reports").select("number").eq("chat_id", id).order("number", { ascending: false }).limit(1).single();
  if (!(await spend(user.id, "followup"))) return bad("no_credits", 402);
  const heat = HEATS.includes(b?.heat as never) ? b!.heat : "spicy";
  const { data: rep, error } = await db.from("reports").insert({
    chat_id: id, user_id: user.id, number: (last?.number ?? 0) + 1, question: q.slice(0, 500),
    lang: b?.lang ?? chat.report_lang, status: "full_pending", unlocked: true, content: { heat },
    snapshot: { stats: chat.stats, participants: chat.participants, context: chat.context, messageCount: chat.message_count, meName: chat.me_name },
  }).select("id").single();
  if (error || !rep) return bad("db_error", 500);
  after(() => runFull(rep.id));
  return ok({ reportId: rep.id });
}
