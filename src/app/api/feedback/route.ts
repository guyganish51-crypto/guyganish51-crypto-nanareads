import { supabaseAdmin, currentUser } from "@/lib/supabase/server";
import { ok, bad, body } from "@/lib/server/http";

export async function POST(req: Request) {
  const b = await body<{ kind?: string; message?: string; email?: string; meta?: Record<string, unknown> }>(req);
  const message = b?.message?.trim();
  if (!message || message.length > 5000) return bad("bad_message");
  const kind = ["feedback", "support", "report_feedback"].includes(b?.kind ?? "") ? b!.kind : "feedback";
  const user = await currentUser();
  await supabaseAdmin().from("feedback").insert({
    kind, message, email: b?.email?.slice(0, 200) ?? user?.email ?? null, user_id: user?.id ?? null, meta: b?.meta ?? {},
  });
  return ok({ ok: true });
}
