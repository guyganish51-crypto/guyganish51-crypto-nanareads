import { currentUser } from "@/lib/supabase/server";
import { ok, bad } from "@/lib/server/http";
import { unlockReport } from "@/lib/server/credits";

export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<"/api/reports/[id]/unlock">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return bad("auth_required", 401);
  const r = await unlockReport(user.id, id);
  if (r === "not_found") return bad("not_found", 404);
  if (r === "not_ready") return bad("not_ready", 409);
  if (r === "no_credits") return bad("no_credits", 402);
  return ok({ status: "full_pending" });
}
