import { supabaseAdmin, currentUser } from "@/lib/supabase/server";
import { ok, bad, body } from "@/lib/server/http";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return bad("auth_required", 401);
  const b = await body<{ what: "chat" | "report" | "account"; id?: string }>(req);
  const db = supabaseAdmin();
  if (b?.what === "chat" && b.id) {
    const { data: chat } = await db.from("chats").select("id, user_id, storage_path").eq("id", b.id).single();
    if (!chat || chat.user_id !== user.id) return bad("not_found", 404);
    if (chat.storage_path) await db.storage.from("chats").remove([chat.storage_path]);
    await db.from("chats").delete().eq("id", b.id);
    return ok({ ok: true });
  }
  if (b?.what === "report" && b.id) {
    await db.from("reports").delete().eq("id", b.id).eq("user_id", user.id);
    return ok({ ok: true });
  }
  if (b?.what === "account") {
    const { data: chats } = await db.from("chats").select("storage_path").eq("user_id", user.id);
    const paths = (chats ?? []).map((c) => c.storage_path).filter(Boolean) as string[];
    if (paths.length) await db.storage.from("chats").remove(paths);
    await db.auth.admin.deleteUser(user.id);
    return ok({ ok: true });
  }
  return bad("bad_request");
}
