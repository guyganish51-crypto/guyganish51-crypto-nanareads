import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { ok, bad, body } from "@/lib/server/http";
import { unlockReport } from "@/lib/server/credits";

export const maxDuration = 300;

/**
 * Last step of the email funnel (+51h): the full report for free in exchange for 2 answers.
 * Only valid once the "gift" email was actually sent for this report.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/reports/[id]/gift">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return bad("auth_required", 401);
  const b = await body<{ q1?: string; q2?: string }>(req);
  const q1 = (b?.q1 ?? "").trim().slice(0, 600), q2 = (b?.q2 ?? "").trim().slice(0, 600);
  if (q1.length < 2 || q2.length < 2) return bad("answers_required");
  const db = supabaseAdmin();
  const { data: sent } = await db.from("email_log").select("id").eq("report_id", id).eq("user_id", user.id).eq("kind", "gift").maybeSingle();
  if (!sent) return bad("no_gift", 403);
  await db.from("feedback").insert({ user_id: user.id, kind: "gift_survey", email: user.email, message: `${q1}\n---\n${q2}`, meta: { reportId: id } });
  const r = await unlockReport(user.id, id, { free: `gift:${id}` });
  if (r === "not_found") return bad("not_found", 404);
  if (r === "not_ready") return bad("not_ready", 409);
  return ok({ status: "full_pending" });
}
