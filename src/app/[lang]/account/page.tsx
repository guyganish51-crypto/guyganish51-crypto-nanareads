import { pageCtx } from "@/lib/server/page";
import { PageShell } from "@/components/PageShell";
import { AccountView } from "@/components/AccountView";

export const metadata = { robots: { index: false } };

export default async function Account({ params }: PageProps<"/[lang]/account">) {
  const { lang, t } = await pageCtx(params);
  return <PageShell lang={lang} t={t} title={t.account.title}><AccountView lang={lang} t={t} /></PageShell>;
}
