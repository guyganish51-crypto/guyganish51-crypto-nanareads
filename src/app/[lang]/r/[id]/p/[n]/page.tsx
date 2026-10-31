import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageCtx } from "@/lib/server/page";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NanaAvatar } from "@/components/NanaAvatar";
import { Arrow } from "@/components/Arrow";
import { fmt } from "@/lib/fmt";
import type { Block } from "@/lib/ai/schema";

interface Person { name: string; title: string; blocks?: Block[] }

async function load(id: string, n: string) {
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^\d{1,2}$/.test(n)) return null;
  try {
    const { data } = await supabaseAdmin().from("reports").select("title, unlocked, preview, content").eq("id", id).maybeSingle();
    if (!data) return null;
    const people = (data.unlocked ? data.content?.report?.people : data.preview?.people) ?? data.preview?.people ?? [];
    const person = people[Number(n)] as Person | undefined;
    return person ? { title: data.title as string, person } : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: PageProps<"/[lang]/r/[id]/p/[n]">): Promise<Metadata> {
  const { id, n } = await params;
  const r = await load(id, n);
  if (!r) return { robots: { index: false } };
  return {
    title: `${r.person.name} — ${r.person.title}`,
    robots: { index: false, follow: false },
    openGraph: { title: `${r.person.name} — ${r.person.title}`, description: r.title, images: [`/api/og/${id}?p=${n}`] },
    twitter: { card: "summary_large_image", images: [`/api/og/${id}?p=${n}`] },
  };
}

/** One person's card from a report: what gets shared to the group, person by person. */
export default async function PersonPage({ params }: PageProps<"/[lang]/r/[id]/p/[n]">) {
  const { lang, t } = await pageCtx(params);
  const { id, n } = await params;
  const r = await load(id, n);
  if (!r) notFound();
  const R = t.report;
  const firstPara = r.person.blocks?.find((b) => b.type === "p")?.text;
  return (
    <>
      <Header lang={lang} t={t} />
      <main className="mx-auto max-w-xl px-4 pt-10">
        <p className="text-sm font-semibold text-tomato-dark" dir="auto">{fmt(R.personKicker, { name: r.person.name })}</p>
        <div className="card mt-3 p-6">
          <div className="flex items-center gap-3"><NanaAvatar size={56} /><div><h1 className="font-display text-3xl font-bold" dir="auto">{r.person.name}</h1><p className="font-medium" dir="auto">{r.person.title}</p></div></div>
          {firstPara && <p className="mt-5 text-lg leading-relaxed" dir="auto">{firstPara}</p>}
          <p className="mt-5 text-sm text-ink-soft" dir="auto">📖 {r.title}</p>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Link href={`/${lang}/r/${id}`} className="btn btn-primary">{R.readFull} <Arrow /></Link>
          <Link href={`/${lang}/start?from=person_card`} className="btn btn-ghost">{R.sendYours} <Arrow /></Link>
        </div>
      </main>
      <Footer lang={lang} t={t} />
    </>
  );
}
