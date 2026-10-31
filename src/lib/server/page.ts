import "server-only";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dict } from "@/lib/i18n/dictionaries";

export async function pageCtx(params: Promise<{ lang: string }>): Promise<{ lang: Locale; t: Dict }> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { lang, t: await getDictionary(lang) };
}
