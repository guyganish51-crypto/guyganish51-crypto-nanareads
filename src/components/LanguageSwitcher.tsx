"use client";
import { usePathname, useRouter } from "next/navigation";
import { locales, localeNames, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ lang, label }: { lang: Locale; label: string }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span>🌐 {label}</span>
      <select
        className="rounded-lg border-2 border-ink bg-paper px-2 py-1"
        value={lang}
        onChange={(e) => {
          const rest = path.split("/").slice(2).join("/");
          document.cookie = `NEXT_LOCALE=${e.target.value};path=/;max-age=31536000`;
          router.push(`/${e.target.value}${rest ? "/" + rest : ""}`);
        }}
      >
        {locales.map((l) => (
          <option key={l} value={l}>{localeNames[l]}</option>
        ))}
      </select>
    </label>
  );
}
