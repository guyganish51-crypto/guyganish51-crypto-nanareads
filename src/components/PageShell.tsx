import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function PageShell({ lang, t, title, children, wide = false }: { lang: Locale; t: Dict; title?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <>
      <Header lang={lang} t={t} />
      <main className={`mx-auto px-4 pt-10 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        {title && <h1 className="font-display mb-6 text-4xl font-bold leading-tight">{title}</h1>}
        {children}
      </main>
      <Footer lang={lang} t={t} />
    </>
  );
}
