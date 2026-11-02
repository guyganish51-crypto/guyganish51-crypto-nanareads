import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { pageCtx } from "@/lib/server/page";
import { PageShell } from "@/components/PageShell";
import { alternates, href } from "@/lib/site";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { Arrow } from "@/components/Arrow";
import { fmt } from "@/lib/fmt";
import { PACKS, currencyFor, priceOf, formatPrice } from "@/lib/billing/pricing";

export async function generateMetadata({ params }: PageProps<"/[lang]/pricing">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = await getDictionary(lang);
  return { title: t.pricing.title, description: t.pricing.sub, alternates: alternates("/pricing") };
}

/** Public prices in the visitor's currency (also what Paddle's website review looks for). */
export default async function Pricing({ params }: PageProps<"/[lang]/pricing">) {
  const { lang, t } = await pageCtx(params);
  const P = t.report.pay, X = t.pricing;
  const cur = currencyFor((await headers()).get("x-vercel-ip-country"));
  const price = (m: number) => formatPrice(m, cur, lang);
  const label = { single: P.single, trio: P.trio, ten: P.ten } as const;
  return (
    <PageShell lang={lang} t={t} title={X.title}>
      <p className="mb-6 text-ink-soft">{X.sub}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5 sm:col-span-3 !bg-sky/40">
          <h2 className="font-display text-xl font-bold">{X.freeH}</h2>
          <p className="mt-1 text-ink-soft">{X.freeD}</p>
          <p className="font-display mt-2 text-2xl font-bold">{X.free}</p>
        </div>
        {PACKS.map((p) => (
          <div key={p.id} className={`card p-5 ${p.id === "trio" ? "!bg-butter/50" : ""}`}>
            <h2 className="font-display text-xl font-bold">{label[p.id]}</h2>
            {p.id === "trio" && <span className="mt-1 inline-block rounded-full bg-sage px-2 py-0.5 text-xs font-bold">{P.popular}</span>}
            {p.id === "ten" && <span className="mt-1 inline-block rounded-full bg-sky px-2 py-0.5 text-xs font-bold">{P.best}</span>}
            <p className="font-display mt-3 text-3xl font-bold">{price(priceOf(cur, p.id))}</p>
            {p.credits > 1 && <p className="text-sm text-ink-soft">{fmt(P.perReport, { price: price(Math.round(priceOf(cur, p.id) / p.credits)) })}</p>}
          </div>
        ))}
      </div>
      <ul className="mt-6 space-y-1.5 text-sm text-ink-soft">
        <li>✓ {X.includes}</li>
        <li>✓ {P.tax}</li>
        <li>✓ {P.credits}</li>
        <li>✓ {P.refund}</li>
        <li>🔒 {P.trust}</li>
      </ul>
      <Link href={href(lang, "/start")} className="btn btn-primary mt-8">{t.nav.cta} <Arrow /></Link>
    </PageShell>
  );
}
