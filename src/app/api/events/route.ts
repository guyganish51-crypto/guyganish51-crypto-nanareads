import { supabaseAdmin, currentUser } from "@/lib/supabase/server";
import { ok, body } from "@/lib/server/http";

export async function POST(req: Request) {
  const b = await body<{ name?: string; attemptId?: string; props?: Record<string, unknown> }>(req);
  if (!b?.name || b.name.length > 60) return ok({ ok: false });
  const user = await currentUser();
  await supabaseAdmin().from("events").insert({
    name: b.name, attempt_id: b.attemptId && /^[0-9a-f-]{36}$/.test(b.attemptId) ? b.attemptId : null,
    user_id: user?.id ?? null, props: b.props ?? {},
  });
  return ok({ ok: true });
}
