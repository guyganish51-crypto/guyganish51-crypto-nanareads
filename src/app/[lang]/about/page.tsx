import type { Metadata } from "next";
import { pageCtx } from "@/lib/server/page";
import { PageShell } from "@/components/PageShell";
import { NanaAvatar } from "@/components/NanaAvatar";
import { alternates } from "@/lib/site";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).about.title, alternates: alternates("/about") };
}

export default async function About({ params }: PageProps<"/[lang]/about">) {
  const { lang, t } = await pageCtx(params);
  return (
    <PageShell lang={lang} t={t} title={t.about.title}>
      <div className="flex justify-center"><NanaAvatar size={120} /></div>
      <div className="prose-nana mt-4">{t.about.body.map((p, i) => <p key={i}>{p}</p>)}</div>
      <h2 className="font-display mt-8 mb-3 text-2xl font-bold">{t.about.factsTitle}</h2>
      <dl className="card divide-y-2 divide-ink/10 p-2">
        {t.about.facts.map(([k, v], i) => (
          <div key={i} className="flex justify-between gap-4 p-3"><dt className="font-semibold">{k}</dt><dd className="text-end text-ink-soft">{v}</dd></div>
        ))}
      </dl>
    </PageShell>
  );
}
