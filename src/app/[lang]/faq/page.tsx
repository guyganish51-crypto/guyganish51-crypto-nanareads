import type { Metadata } from "next";
import Link from "next/link";
import { pageCtx } from "@/lib/server/page";
import { PageShell } from "@/components/PageShell";
import { alternates, href } from "@/lib/site";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { Arrow } from "@/components/Arrow";

export async function generateMetadata({ params }: PageProps<"/[lang]/faq">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).faq.title, alternates: alternates("/faq") };
}

export default async function Faq({ params }: PageProps<"/[lang]/faq">) {
  const { lang, t } = await pageCtx(params);
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: t.faq.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })) };
  return (
    <PageShell lang={lang} t={t} title={t.faq.title}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div className="space-y-3">
        {t.faq.items.map((i, k) => (
          <details key={k} className="card group p-5" open={k < 2}>
            <summary className="cursor-pointer list-none text-lg font-semibold">{i.q}</summary>
            <p className="mt-2 leading-relaxed text-ink-soft">{i.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-8 text-center"><Link href={href(lang, "/start")} className="btn btn-primary">{t.nav.cta} <Arrow /></Link></div>
    </PageShell>
  );
}
