import { supabaseAdmin } from "@/lib/supabase/server";
import { ok, bad } from "@/lib/server/http";

export const maxDuration = 60;

/** Daily: delete expired chats (file + row) and abandoned attempts. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return bad("unauthorized", 401);
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const { data: expired } = await db.from("chats").select("id, storage_path, user_id").lt("expires_at", now).not("storage_path", "is", null).limit(1000);
  if (expired?.length) {
    await db.storage.from("chats").remove(expired.map((c) => c.storage_path as string));
    // claimed chats keep their metadata row (reports stay readable); unclaimed ones go entirely
    await db.from("chats").update({ storage_path: null, purged_at: now }).in("id", expired.filter((c) => c.user_id).map((c) => c.id));
    await db.from("chats").delete().in("id", expired.filter((c) => !c.user_id).map((c) => c.id));
  }
  const cutoff = new Date(Date.now() - 48 * 3_600_000).toISOString();
  await db.from("attempts").delete().is("user_id", null).lt("created_at", cutoff);
  return ok({ deletedChats: expired?.length ?? 0 });
}
