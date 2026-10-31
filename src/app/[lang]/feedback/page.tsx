import { pageCtx } from "@/lib/server/page";
import { PageShell } from "@/components/PageShell";
import { MessageForm } from "@/components/MessageForm";

export const metadata = { robots: { index: false } };

export default async function Feedback({ params }: PageProps<"/[lang]/feedback">) {
  const { lang, t } = await pageCtx(params);
  return (
    <PageShell lang={lang} t={t} title={t.feedback.title}>
      <p className="mb-4 text-ink-soft">{t.feedback.sub}</p>
      <MessageForm kind="feedback" labels={{ message: t.feedback.placeholder, send: t.feedback.send, sent: t.feedback.sent, error: t.common.error }} />
    </PageShell>
  );
}
