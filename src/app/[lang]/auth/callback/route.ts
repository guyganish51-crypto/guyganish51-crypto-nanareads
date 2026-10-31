import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Magic-link fallback: exchange the code for a session, then continue. */
export async function GET(req: Request, ctx: RouteContext<"/[lang]/auth/callback">) {
  const { lang } = await ctx.params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? `/${lang}/account`;
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : `/${lang}/account`;
  if (code) {
    const sb = await supabaseServer();
    await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
