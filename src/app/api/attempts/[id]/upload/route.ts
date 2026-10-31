import { supabaseAdmin } from "@/lib/supabase/server";
import { ok, bad, body, SOURCES } from "@/lib/server/http";
import { isLocale } from "@/lib/i18n/config";

interface Body {
  secret: string; source: string; title?: string | null; participants: string[];
  messageCount: number; firstAt: number | null; lastAt: number | null; stats: Record<string, unknown>; lang?: string;
}

/** Register the parsed chat and get a signed URL to upload the gzipped messages. */
export async function POST(req: Request, ctx: RouteContext<"/api/attempts/[id]/upload">) {
  const { id } = await ctx.params;
  const b = await body<Body>(req);
  if (!b?.secret || !Array.isArray(b.participants)) return bad("bad_request");
  if (!SOURCES.includes(b.source as never)) return bad("bad_source");
  if (b.messageCount < 10) return bad("too_few_messages");
  const db = supabaseAdmin();
  const { data: att } = await db.from("attempts").select("*").eq("id", id).single();
  if (!att || att.secret !== b.secret) return bad("not_found", 404);
  const chatId = crypto.randomUUID();
  const path = `${id}/${chatId}.json.gz`;
  const { error } = await db.from("chats").insert({
    id: chatId, attempt_id: id, user_id: att.user_id, context: att.context, source: b.source,
    title: b.title?.slice(0, 200) ?? null, storage_path: path, participants: b.participants.slice(0, 200),
    message_count: b.messageCount, first_at: b.firstAt ? new Date(b.firstAt).toISOString() : null,
    last_at: b.lastAt ? new Date(b.lastAt).toISOString() : null, stats: b.stats,
    report_lang: isLocale(b.lang) ? b.lang : att.locale,
  });
  if (error) return bad("db_error", 500);
  const { data: signed, error: se } = await db.storage.from("chats").createSignedUploadUrl(path);
  if (se || !signed) return bad("storage_error", 500);
  await db.from("attempts").update({ status: "uploaded", source: b.source, updated_at: new Date().toISOString() }).eq("id", id);
  return ok({ chatId, path, token: signed.token });
}
