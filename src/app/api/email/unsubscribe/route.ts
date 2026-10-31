import { supabaseAdmin } from "@/lib/supabase/server";
import { checkUnsub } from "@/lib/email/send";

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const uid = checkUnsub(t);
  if (uid) await supabaseAdmin().from("email_optout").upsert({ user_id: uid });
  return new Response(`<!doctype html><meta name=viewport content="width=device-width"><body style="font-family:sans-serif;background:#fbf4e9;padding:40px;text-align:center"><h1>🫖</h1><p>${uid ? "You're unsubscribed. Nana won't nag you again." : "Invalid link."}</p></body>`, { headers: { "content-type": "text/html; charset=utf-8" } });
}
