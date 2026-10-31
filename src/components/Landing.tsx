import Link from "next/link";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/site";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { DemoPicker } from "./DemoPicker";
import { NanaAvatar } from "./NanaAvatar";
import { AppBadge, APP_KEYS, appLabel } from "./AppIcons";
import { Arrow } from "@/components/Arrow";

export function Landing({ lang, t, h1, sub, from }: { lang: Locale; t: Dict; h1: string; sub: string; from: string }) {
  const H = t.home;
  const start = href(lang, `/start?from=${from}`);
  const strip = t.demos.flatMap((d) => [d.label]).concat(t.examples.items.map((_, i) => ["💔", "🍻", "🏡", "💍", "👀"][i % 5]));
  return (
    <>
      <Header lang={lang} t={t} />
      <main className="mx-auto max-w-5xl px-4">
        <section className="flex flex-col items-center pt-10 text-center sm:pt-16">
          <NanaAvatar size={112} className="rise" />
          <p className="mt-4 text-sm font-medium text-ink-soft">{H.eyebrow}</p>
          <h1 className="font-display mt-2 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">{h1}</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-soft">{sub}</p>
          <Link href={start} className="btn btn-primary mt-7 !px-8 !py-4 !text-lg">{H.cta} <Arrow /></Link>
          <p className="mt-3 text-sm text-ink-soft">{H.ctaNote}</p>
        </section>

        <div className="relative mt-10 overflow-hidden" aria-hidden dir="ltr">
          <div className="marquee flex w-max gap-3">
            {[...strip, ...strip, ...strip, ...strip].map((s, i) => (
              <span key={i} className="chip text-sm">{s}</span>
            ))}
          </div>
        </div>

        <section className="mt-14">
          <h2 className="font-display mb-4 text-center text-3xl font-bold">{H.demoTitle}</h2>
          <DemoPicker demos={t.demos} lockedLabel={t.report.lockedTitle} byLabel={t.report.by} hint={H.demoHint} />
        </section>

        <section className="mt-16">
          <h2 className="font-display mb-6 text-center text-3xl font-bold">{H.howTitle}</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {H.how.map((s, i) => (
              <li key={i} className="card p-5">
                <div className="font-display text-4xl font-bold text-tomato">{i + 1}</div>
                <h3 className="mt-1 text-lg font-semibold">{s.t}</h3>
                <p className="mt-1 text-ink-soft">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <h2 className="font-display mb-6 text-center text-3xl font-bold">{H.findsTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {H.finds.map((f, i) => (
              <div key={i} className={`card p-5 ${["!bg-sky/40", "!bg-butter/50", "!bg-blush/50", "!bg-sage/40"][i % 4]}`}>
                <div className="text-3xl">{f.e}</div>
                <h3 className="mt-2 text-lg font-semibold">{f.t}</h3>
                <p className="mt-1 text-ink-soft">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display mb-6 text-center text-3xl font-bold">{H.heatTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["gentle", "spicy", "savage"] as const).map((k, i) => (
              <div key={k} className="card p-5 text-center">
                <div className="text-3xl">{["🫖", "🌶️", "🔥"][i]}</div>
                <h3 className="mt-2 text-lg font-semibold">{H.heat[k].t}</h3>
                <p className="mt-1 text-sm text-ink-soft">{H.heat[k].d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display mb-2 text-center text-3xl font-bold">{t.examples.title}</h2>
          <p className="mb-6 text-center text-sm text-ink-soft">{t.examples.note}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {t.examples.items.map((x, i) => (
              <blockquote key={i} className="card flex gap-3 p-5">
                <NanaAvatar size={32} className="shrink-0" />
                <p className="font-display text-lg leading-snug">“{x}”</p>
              </blockquote>
            ))}
          </div>
        </section>

        <section className="card mt-16 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold">🔒 {H.privacyTitle}</h2>
          <ul className="mt-3 space-y-2">
            {H.privacy.map((p, i) => <li key={i} className="flex gap-2"><span>✓</span><span>{p}</span></li>)}
          </ul>
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold">{H.worksWith}</p>
            <div className="flex flex-wrap gap-2">
              {APP_KEYS.filter((k) => k !== "other").map((k) => (
                <span key={k} className="chip text-sm"><AppBadge app={k} size={22} />{appLabel(k)}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16 flex flex-col items-center text-center">
          <h2 className="font-display text-4xl font-bold">{H.finalH}</h2>
          <p className="mt-2 text-ink-soft">{H.finalSub}</p>
          <Link href={start} className="btn btn-primary mt-6 !px-8 !py-4 !text-lg">{H.cta} <Arrow /></Link>
        </section>
      </main>
      <Footer lang={lang} t={t} />
    </>
  );
}
