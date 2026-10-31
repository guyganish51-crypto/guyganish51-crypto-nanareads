import { gzipSync } from "node:zlib";
import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ok, bad, body } from "@/lib/server/http";
import { transcribeFrames } from "@/lib/ai/recording";
import { computeStats } from "@/lib/chat/stats";

export const maxDuration = 300;

/**
 * Screen-recording import, two calls:
 *  POST {secret, action:"sign"}  → signed URL to upload frames.zip (JPEG frames named 0000.jpg…)
 *  POST {secret, action:"read", path} → transcribes, stores the normalized chat, returns chatId + participants
 */
export async function POST(req: Request, ctx: RouteContext<"/api/attempts/[id]/recording">) {
  const { id } = await ctx.params;
  const b = await body<{ secret: string; action: "sign" | "read"; path?: string; source?: string; lang?: string }>(req);
  if (!b?.secret) return bad("bad_request");
  const db = supabaseAdmin();
  const { data: att } = await db.from("attempts").select("*").eq("id", id).single();
  if (!att || att.secret !== b.secret) return bad("not_found", 404);

  if (b.action === "sign") {
    const path = `${id}/recording-${crypto.randomUUID()}.zip`;
    const { data, error } = await db.storage.from("chats").createSignedUploadUrl(path);
    if (error || !data) return bad("storage_error", 500);
    return ok({ path, token: data.token });
  }

  if (!b.path?.startsWith(`${id}/recording-`)) return bad("bad_path");
  const { data: file, error } = await db.storage.from("chats").download(b.path);
  if (error || !file) return bad("missing", 404);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files).filter((n) => n.endsWith(".jpg")).sort().slice(0, 240);
  const frames = await Promise.all(names.map((n) => zip.files[n].async("uint8array")));
  const { title, messages } = await transcribeFrames(frames);
  await db.storage.from("chats").remove([b.path]); // frames are not kept
  if (messages.length < 10) return bad("too_few_messages", 422);

  const stats = { ...computeStats(messages), synthetic: true };
  const participants = [...new Set(messages.map((m) => m.a))];
  const chatId = crypto.randomUUID();
  const path = `${id}/${chatId}.json.gz`;
  const up = await db.storage.from("chats").upload(path, gzipSync(Buffer.from(JSON.stringify({ messages }))), { contentType: "application/gzip" });
  if (up.error) return bad("storage_error", 500);
  await db.from("chats").insert({
    id: chatId, attempt_id: id, user_id: att.user_id, context: att.context, source: b.source ?? att.source ?? "other",
    title, storage_path: path, participants, message_count: messages.length, stats,
    report_lang: b.lang ?? att.locale, me_name: "Me",
  });
  await db.from("attempts").update({ status: "uploaded" }).eq("id", id);
  return ok({ chatId, participants, messageCount: messages.length });
}
