import type { Metadata } from "next";
import { pageCtx } from "@/lib/server/page";
import { ReportView } from "@/components/ReportView";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/r/[id]">): Promise<Metadata> {
  const { id } = await params;
  let title: string | null = null;
  try {
    if (/^[0-9a-f-]{36}$/.test(id)) {
      const { data } = await supabaseAdmin().from("reports").select("title").eq("id", id).maybeSingle();
      title = data?.title ?? null;
    }
  } catch { /* missing key in dev */ }
  const images = [`/api/og/${id}`];
  return { title: title ?? undefined, robots: { index: false, follow: false }, openGraph: { ...(title ? { title } : {}), images }, twitter: { card: "summary_large_image", images } };
}

export default async function ReportPage({ params }: PageProps<"/[lang]/r/[id]">) {
  const { lang, t } = await pageCtx(params);
  const { id } = await params;
  return (
    <>
      <Header lang={lang} t={t} />
      <ReportView id={id} lang={lang} t={t} />
      <Footer lang={lang} t={t} />
    </>
  );
}
