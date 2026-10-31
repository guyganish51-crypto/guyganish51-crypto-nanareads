import Link from "next/link";
import { pageCtx } from "@/lib/server/page";
import { PageShell } from "@/components/PageShell";
import { MessageForm } from "@/components/MessageForm";
import { href } from "@/lib/site";
import { Arrow } from "@/components/Arrow";

export const metadata = { robots: { index: false } };

export default async function Support({ params }: PageProps<"/[lang]/support">) {
  const { lang, t } = await pageCtx(params);
  return (
    <PageShell lang={lang} t={t} title={t.support.title}>
      <p className="mb-4 text-ink-soft">{t.support.sub}</p>
      <div className="mb-6 space-y-2">
        {t.faq.items.slice(0, 6).map((i, k) => (
          <details key={k} className="card p-4"><summary className="cursor-pointer font-semibold">{i.q}</summary><p className="mt-2 text-ink-soft">{i.a}</p></details>
        ))}
        <Link className="text-sm underline" href={href(lang, "/faq")}>{t.footer.links.faq} <Arrow /></Link>
      </div>
      <MessageForm kind="support" withEmail labels={{ email: t.support.email, message: t.support.message, send: t.support.send, sent: t.support.sent, error: t.common.error }} />
    </PageShell>
  );
}
