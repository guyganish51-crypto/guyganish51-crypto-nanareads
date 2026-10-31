import { supabaseAdmin } from "@/lib/supabase/server";
import { ok, bad, body } from "@/lib/server/http";
import { isLocale } from "@/lib/i18n/config";

export async function POST(req: Request, ctx: RouteContext<"/api/chats/[id]/details">) {
  const { id } = await ctx.params;
  const b = await body<{ secret: string; meName?: string | null; notes?: string; lang?: string }>(req);
  if (!b?.secret) return bad("bad_request");
  const db = supabaseAdmin();
  const { data: chat } = await db.from("chats").select("id, attempt_id, participants").eq("id", id).single();
  if (!chat) return bad("not_found", 404);
  const { data: att } = await db.from("attempts").select("secret").eq("id", chat.attempt_id).single();
  if (att?.secret !== b.secret) return bad("not_found", 404);
  const me = b.meName && (chat.participants as string[]).includes(b.meName) ? b.meName : null;
  await db.from("chats").update({
    me_name: me, notes: b.notes?.slice(0, 1000) || null, report_lang: isLocale(b.lang) ? b.lang : undefined,
  }).eq("id", id);
  return ok({ ok: true });
}
