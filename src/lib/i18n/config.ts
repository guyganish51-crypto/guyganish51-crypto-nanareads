export const locales = [
  "en", "he", "ar", "fr", "es", "pt", "de", "it", "nl", "pl", "ru", "uk",
  "tr", "ro", "el", "sv", "hi", "id", "th", "vi", "ja", "ko", "zh-Hans", "zh-Hant",
] as const;

export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const rtlLocales: Locale[] = ["he", "ar"];

export const localeNames: Record<Locale, string> = {
  en: "English", he: "עברית", ar: "العربية", fr: "Français", es: "Español",
  pt: "Português", de: "Deutsch", it: "Italiano", nl: "Nederlands", pl: "Polski",
  ru: "Русский", uk: "Українська", tr: "Türkçe", ro: "Română", el: "Ελληνικά",
  sv: "Svenska", hi: "हिन्दी", id: "Bahasa Indonesia", th: "ไทย", vi: "Tiếng Việt",
  ja: "日本語", ko: "한국어", "zh-Hans": "简体中文", "zh-Hant": "繁體中文",
};

/** English names, used when instructing the model which language to write in. */
export const localeEnglishNames: Record<Locale, string> = {
  en: "English", he: "Hebrew", ar: "Arabic", fr: "French", es: "Spanish",
  pt: "Portuguese", de: "German", it: "Italian", nl: "Dutch", pl: "Polish",
  ru: "Russian", uk: "Ukrainian", tr: "Turkish", ro: "Romanian", el: "Greek",
  sv: "Swedish", hi: "Hindi", id: "Indonesian", th: "Thai", vi: "Vietnamese",
  ja: "Japanese", ko: "Korean", "zh-Hans": "Simplified Chinese", "zh-Hant": "Traditional Chinese",
};

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (locales as readonly string[]).includes(v);
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

/** Map an Accept-Language header to one of our locales. */
export function matchLocale(header: string | null): Locale {
  if (!header) return defaultLocale;
  const prefs = header
    .split(",")
    .map((p) => {
      const [tag, q] = p.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of prefs) {
    if (tag.startsWith("zh")) {
      return /hant|tw|hk|mo/.test(tag) ? "zh-Hant" : "zh-Hans";
    }
    if (tag === "iw" || tag.startsWith("iw-")) return "he";
    const base = tag.split("-")[0];
    const hit = locales.find((l) => l.toLowerCase() === base);
    if (hit) return hit;
  }
  return defaultLocale;
}
