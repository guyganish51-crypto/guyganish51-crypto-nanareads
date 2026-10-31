import { supabaseAdmin, currentUser } from "@/lib/supabase/server";
import { ok, bad } from "@/lib/server/http";
import { balance } from "@/lib/server/credits";

/** Report status + visible content. The UUID is the share capability. */
export async function GET(_req: Request, ctx: RouteContext<"/api/reports/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return bad("not_found", 404);
  const db = supabaseAdmin();
  const { data: rep } = await db.from("reports").select("id, chat_id, user_id, number, status, unlocked, lang, title, preview, content, question, created_at, snapshot").eq("id", id).single();
  if (!rep) return bad("not_found", 404);
  const user = await currentUser();
  const isOwner = user?.id === rep.user_id;
  const snap = rep.snapshot as { stats?: unknown; participants?: string[]; context?: string; messageCount?: number; meName?: string | null };
  let chatAlive = false;
  if (isOwner && rep.chat_id) {
    const { data: c } = await db.from("chats").select("storage_path").eq("id", rep.chat_id).maybeSingle();
    chatAlive = !!c?.storage_path;
  }
  return ok({
    id: rep.id, chatId: rep.chat_id, number: rep.number, status: rep.status, unlocked: rep.unlocked, lang: rep.lang,
    title: rep.title, question: rep.question, preview: rep.preview,
    report: rep.unlocked ? rep.content?.report ?? null : null,
    cutoff: rep.content?.cutoff ?? rep.preview?.cutoff ?? null,
    chat: { stats: snap.stats ?? null, participants: snap.participants ?? [], context: snap.context ?? "other", messageCount: snap.messageCount ?? 0, meName: isOwner ? snap.meName ?? null : null },
    chatAlive,
    isOwner, credits: isOwner && user ? await balance(user.id) : null,
  });
}
