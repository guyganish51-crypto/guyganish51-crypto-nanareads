import { supabaseAdmin, currentUser } from "@/lib/supabase/server";
import { ok, bad } from "@/lib/server/http";
import { balance } from "@/lib/server/credits";

export async function GET() {
  const user = await currentUser();
  if (!user) return bad("auth_required", 401);
  const db = supabaseAdmin();
  const { data: chats } = await db.from("chats").select("id, title, context, source, participants, message_count, created_at, expires_at").eq("user_id", user.id).order("created_at", { ascending: false });
  const { data: reports } = await db.from("reports").select("id, chat_id, number, status, unlocked, title, question, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  return ok({ email: user.email, credits: await balance(user.id), chats: chats ?? [], reports: reports ?? [] });
}
