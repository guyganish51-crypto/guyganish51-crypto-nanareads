import Link from "next/link";
import { Avatar } from "./Avatar";
import { href } from "@/lib/site";
import type { Dict } from "@/lib/i18n/dictionaries";
import { Arrow } from "@/components/Arrow";

export function Header({ lang, t }: { lang: string; t: Dict }) {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href={href(lang)} className="flex items-center gap-2">
          <Avatar size={38} />
          <span className="font-display whitespace-nowrap text-lg font-bold tracking-tight sm:text-xl">{t.meta.siteName}</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href={href(lang, "/account")} className="hidden text-sm font-medium underline-offset-4 hover:underline sm:inline">
            {t.nav.account}
          </Link>
          <Link href={href(lang, "/start")} aria-label={t.nav.cta} className="btn btn-primary !px-4 !py-2 !text-sm">
            <span className="hidden sm:inline">{t.nav.cta}</span><span className="sm:hidden">🎧</span> <Arrow />
          </Link>
        </nav>
      </div>
    </header>
  );
}
