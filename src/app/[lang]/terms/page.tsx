import type { Metadata } from "next";
import { pageCtx } from "@/lib/server/page";
import { PageShell } from "@/components/PageShell";
import { TERMS, LEGAL_UPDATED } from "@/lib/site/legal";
import { alternates } from "@/lib/site";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).legal.terms, alternates: alternates("/terms") };
}

export default async function Page({ params }: PageProps<"/[lang]/terms">) {
  const { lang, t } = await pageCtx(params);
  return (
    <PageShell lang={lang} t={t} title={t.legal.terms}>
      {lang !== "en" && <p className="card mb-6 p-3 text-sm">{t.legal.englishOnly}</p>}
      <div dir="ltr" lang="en" className="space-y-6 text-left">
        {TERMS.map((s) => (
          <section key={s.h}>
            <h2 className="mb-2 text-xl font-bold">{s.h}</h2>
            {s.p.map((p, i) => <p key={i} className="mb-2 leading-relaxed text-ink-soft">{p}</p>)}
          </section>
        ))}
        <p className="text-sm text-ink-soft">Last updated: {LEGAL_UPDATED}</p>
      </div>
    </PageShell>
  );
}
