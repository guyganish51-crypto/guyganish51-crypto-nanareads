import { pageCtx } from "@/lib/server/page";
import { StartFlow } from "@/components/StartFlow";

export const metadata = { robots: { index: false, follow: false } };

export default async function Start({ params }: PageProps<"/[lang]/start">) {
  const { lang, t } = await pageCtx(params);
  return <StartFlow lang={lang} t={t} />;
}
