import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Landing } from "@/components/Landing";
import { alternates } from "@/lib/site";

const TOPICS = ["relationship", "friends", "family", "imessage", "whatsapp"] as const;
type Topic = (typeof TOPICS)[number];
const isTopic = (t: string): t is Topic => (TOPICS as readonly string[]).includes(t);

export const dynamicParams = false;
export function generateStaticParams() {
  return locales.flatMap((lang) => TOPICS.map((topic) => ({ lang, topic })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[topic]">): Promise<Metadata> {
  const { lang, topic } = await params;
  if (!isLocale(lang) || !isTopic(topic)) return {};
  const L = (await getDictionary(lang)).landing[topic];
  return { title: { absolute: L.metaTitle }, description: L.metaDesc, alternates: alternates(`/${topic}`), openGraph: { title: L.metaTitle, description: L.metaDesc } };
}

export default async function TopicPage({ params }: PageProps<"/[lang]/[topic]">) {
  const { lang, topic } = await params;
  if (!isLocale(lang) || !isTopic(topic)) notFound();
  const t = await getDictionary(lang);
  const L = t.landing[topic];
  return <Landing lang={lang} t={t} h1={L.h1} sub={L.sub} from={topic} />;
}
