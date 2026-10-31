import { after } from "next/server";
import { supabaseAdmin, currentUser } from "@/lib/supabase/server";
import { ok, bad } from "@/lib/server/http";
import { spend } from "@/lib/server/credits";
import { runFull } from "@/lib/ai/generate";

export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<"/api/reports/[id]/unlock">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return bad("auth_required", 401);
  const db = supabaseAdmin();
  const { data: rep } = await db.from("reports").select("id, user_id, status, unlocked").eq("id", id).single();
  if (!rep || rep.user_id !== user.id) return bad("not_found", 404);
  if (rep.unlocked) return ok({ status: rep.status });
  if (rep.status !== "preview_ready") return bad("not_ready", 409);
  if (!(await spend(user.id, "unlock", id))) return bad("no_credits", 402);
  await db.from("reports").update({ unlocked: true, status: "full_pending" }).eq("id", id);
  after(() => runFull(id));
  return ok({ status: "full_pending" });
}
