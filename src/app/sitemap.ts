import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/site";
const PATHS = ["", "/relationship", "/friends", "/family", "/whatsapp", "/imessage", "/faq", "/about", "/privacy", "/terms"];
export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.flatMap((p) => locales.map((l) => ({
    url: `${SITE_URL}/${l}${p}`,
    alternates: { languages: Object.fromEntries(locales.map((x) => [x, `${SITE_URL}/${x}${p}`])) },
  })));
}
