import { locales } from "@/lib/i18n/config";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nanareads.app";
export const href = (lang: string, path = "") => `/${lang}${path ? (path.startsWith("/") ? path : `/${path}`) : ""}`;

export function alternates(path = "") {
  return {
    canonical: `${SITE_URL}/en${path}`,
    languages: Object.fromEntries([
      ...locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
      ["x-default", `${SITE_URL}/en${path}`],
    ]),
  };
}
