import Link from "next/link";
import { href } from "@/lib/site";
import { fmt } from "@/lib/fmt";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NanaAvatar } from "./NanaAvatar";

export function Footer({ lang, t }: { lang: Locale; t: Dict }) {
  const L = t.footer.links;
  const col = (title: string, items: [string, string][]) => (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <ul className="space-y-1.5 text-sm text-ink-soft">
        {items.map(([label, path]) => (
          <li key={path}><Link className="hover:underline" href={href(lang, path)}>{label}</Link></li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="mt-20 border-t-2 border-ink bg-paper">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2"><NanaAvatar size={34} /><span className="font-display text-lg font-bold">{t.meta.siteName}</span></div>
          <LanguageSwitcher lang={lang} label={t.nav.language} />
        </div>
        {col(t.footer.chats, [[L.home, ""], [L.relationship, "/relationship"], [L.friends, "/friends"], [L.family, "/family"], [L.whatsapp, "/whatsapp"], [L.imessage, "/imessage"]])}
        {col(t.footer.help, [[L.account, "/account"], [L.faq, "/faq"], [L.support, "/support"], [L.feedback, "/feedback"]])}
        {col(t.footer.company, [[L.about, "/about"], [L.privacy, "/privacy"], [L.terms, "/terms"]])}
      </div>
      <p className="pb-8 text-center text-xs text-ink-soft">{fmt(t.footer.rights, { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
