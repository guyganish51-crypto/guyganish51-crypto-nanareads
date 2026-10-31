import "server-only";
import type { Locale } from "./config";
import en from "@/messages/en.json";

export type Dict = typeof en;

const loaders: Record<Locale, () => Promise<unknown>> = {
  en: async () => en,
  he: () => import("@/messages/he.json").then((m) => m.default),
  ar: () => import("@/messages/ar.json").then((m) => m.default),
  fr: () => import("@/messages/fr.json").then((m) => m.default),
  es: () => import("@/messages/es.json").then((m) => m.default),
  pt: () => import("@/messages/pt.json").then((m) => m.default),
  de: () => import("@/messages/de.json").then((m) => m.default),
  it: () => import("@/messages/it.json").then((m) => m.default),
  nl: () => import("@/messages/nl.json").then((m) => m.default),
  pl: () => import("@/messages/pl.json").then((m) => m.default),
  ru: () => import("@/messages/ru.json").then((m) => m.default),
  uk: () => import("@/messages/uk.json").then((m) => m.default),
  tr: () => import("@/messages/tr.json").then((m) => m.default),
  ro: () => import("@/messages/ro.json").then((m) => m.default),
  el: () => import("@/messages/el.json").then((m) => m.default),
  sv: () => import("@/messages/sv.json").then((m) => m.default),
  hi: () => import("@/messages/hi.json").then((m) => m.default),
  id: () => import("@/messages/id.json").then((m) => m.default),
  th: () => import("@/messages/th.json").then((m) => m.default),
  vi: () => import("@/messages/vi.json").then((m) => m.default),
  ja: () => import("@/messages/ja.json").then((m) => m.default),
  ko: () => import("@/messages/ko.json").then((m) => m.default),
  "zh-Hans": () => import("@/messages/zh-Hans.json").then((m) => m.default),
  "zh-Hant": () => import("@/messages/zh-Hant.json").then((m) => m.default),
  fa: () => import("@/messages/fa.json").then((m) => m.default),
  ur: () => import("@/messages/ur.json").then((m) => m.default),
  bn: () => import("@/messages/bn.json").then((m) => m.default),
  ms: () => import("@/messages/ms.json").then((m) => m.default),
  fil: () => import("@/messages/fil.json").then((m) => m.default),
  cs: () => import("@/messages/cs.json").then((m) => m.default),
  hu: () => import("@/messages/hu.json").then((m) => m.default),
  da: () => import("@/messages/da.json").then((m) => m.default),
  nb: () => import("@/messages/nb.json").then((m) => m.default),
  fi: () => import("@/messages/fi.json").then((m) => m.default),
  bg: () => import("@/messages/bg.json").then((m) => m.default),
  hr: () => import("@/messages/hr.json").then((m) => m.default),
};

function deepMerge<T>(base: T, over: unknown): T {
  if (Array.isArray(base)) {
    // arrays: take the translation only if it has the same length (keeps structure intact)
    return (Array.isArray(over) && over.length === base.length
      ? base.map((b, i) => deepMerge(b, over[i]))
      : base) as T;
  }
  if (base && typeof base === "object") {
    const out: Record<string, unknown> = {};
    const o = (over && typeof over === "object" ? over : {}) as Record<string, unknown>;
    for (const k of Object.keys(base as object)) {
      out[k] = deepMerge((base as Record<string, unknown>)[k], o[k]);
    }
    return out as T;
  }
  return (typeof over === typeof base && over !== "" ? over : base) as T;
}

export async function getDictionary(locale: Locale): Promise<Dict> {
  if (locale === "en") return en;
  try {
    return deepMerge(en, await loaders[locale]());
  } catch {
    return en;
  }
}

export { fmt } from "@/lib/fmt";
