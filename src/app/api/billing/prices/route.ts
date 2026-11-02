import { currentUser } from "@/lib/supabase/server";
import { ok } from "@/lib/server/http";
import { PACKS, currencyFor, priceOf } from "@/lib/billing/pricing";
import { activeOffer } from "@/lib/billing/offer";
import { paddleConfigured } from "@/lib/billing/paddle";

/** Local prices for the paywall (currency from the visitor's country), plus any active offer. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const reportId = url.searchParams.get("report");
  const country = req.headers.get("x-vercel-ip-country");
  const currency = currencyFor(country);
  const user = await currentUser();
  const offer = user ? await activeOffer(user.id, reportId) : null;
  return ok({
    configured: paddleConfigured(),
    currency,
    packs: PACKS.map((p) => ({ id: p.id, credits: p.credits, amount: priceOf(currency, p.id), was: null as number | null })),
    offer: offer ? { expiresAt: offer.expiresAt, amount: priceOf(currency, "single", true), was: priceOf(currency, "single") } : null,
  });
}
