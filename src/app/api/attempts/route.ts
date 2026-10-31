import { supabaseAdmin, currentUser } from "@/lib/supabase/server";
import { ok, bad, body, CONTEXTS, SOURCES } from "@/lib/server/http";
import { isLocale } from "@/lib/i18n/config";

export async function POST(req: Request) {
  const b = await body<{ context?: string; source?: string; locale?: string }>(req);
  if (!b || !CONTEXTS.includes(b.context as never)) return bad("bad_context");
  if (b.source && !SOURCES.includes(b.source as never)) return bad("bad_source");
  const user = await currentUser();
  const { data, error } = await supabaseAdmin().from("attempts").insert({
    context: b.context, source: b.source ?? null, locale: isLocale(b.locale) ? b.locale : "en", user_id: user?.id ?? null,
  }).select("id, secret").single();
  if (error) return bad("db_error", 500);
  return ok(data);
}
