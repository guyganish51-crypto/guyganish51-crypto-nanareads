"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/fmt";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Me {
  email: string; credits: number;
  chats: { id: string; title: string | null; context: string; source: string; participants: string[]; message_count: number; created_at: string; expires_at: string }[];
  reports: { id: string; chat_id: string | null; number: number; status: string; unlocked: boolean; title: string | null; question: string | null; created_at: string }[];
}

export function AccountView({ lang, t }: { lang: Locale; t: Dict }) {
  const A = t.account, E = t.flow.email;
  const sb = useMemo(() => supabaseBrowser(), []);
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/me", { cache: "no-store" });
    if (r.status === 401) return setState("out");
    setMe(await r.json()); setState("in");
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = async (what: string, id?: string) => {
    if (!confirm(A.confirm)) return;
    await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ what, id }) });
    if (what === "account") { await sb.auth.signOut(); location.href = `/${lang}`; } else load();
  };

  if (state === "loading") return <p className="text-ink-soft">{t.common.loading}</p>;
  if (state === "out") return (
    <div className="card space-y-3 p-5">
      <p className="font-semibold">{A.signIn}</p>
      {err && <p className="text-tomato-dark">{err}</p>}
      {!sent ? (
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/${lang}/auth/callback?next=/${lang}/account` } });
          if (error) setErr(/rate|seconds/i.test(error.message) ? E.errors.rate : E.errors.email); else { setSent(true); setErr(null); }
        }}>
          <input type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={E.placeholder} className="w-full rounded-xl border-2 border-ink bg-paper px-3 py-2.5" />
          <button className="btn btn-primary w-full">{E.send}</button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await sb.auth.verifyOtp({ email, token: code, type: "email" });
          if (error) setErr(E.errors.code); else load();
        }}>
          <p>{fmt(E.code, { email })}</p>
          <input inputMode="numeric" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-full rounded-xl border-2 border-ink bg-paper px-3 py-3 text-center font-mono text-2xl tracking-[0.4em]" />
          <button className="btn btn-primary w-full">{E.verify}</button>
        </form>
      )}
    </div>
  );
  if (!me) return null;
  const date = (s: string) => new Date(s).toLocaleDateString(lang);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="font-semibold" dir="ltr">{me.email}</div><div className="text-sm text-ink-soft">{fmt(A.credits, { n: me.credits })}</div></div>
        <button className="chip text-sm" onClick={async () => { await sb.auth.signOut(); location.reload(); }}>{A.signOut}</button>
      </div>
      {me.chats.length === 0 && me.reports.length === 0 && (
        <div className="card p-6 text-center"><p>{A.empty}</p><Link className="btn btn-primary mt-4" href={`/${lang}/start`}>{t.nav.cta} →</Link></div>
      )}
      {me.chats.map((c) => {
        const reps = me.reports.filter((r) => r.chat_id === c.id).sort((a, b) => a.number - b.number);
        return (
          <div key={c.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{c.title ?? c.participants.slice(0, 3).join(", ")}</h2>
                <p className="text-sm text-ink-soft">{c.message_count.toLocaleString(lang)} · {date(c.created_at)}</p>
                <p className="text-xs text-ink-soft">{fmt(A.chatExpires, { date: date(c.expires_at) })}</p>
              </div>
              <button className="text-sm underline" onClick={() => del("chat", c.id)}>{A.deleteChat}</button>
            </div>
            <ul className="mt-3 space-y-2">
              {reps.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-ink/20 p-2.5">
                  <Link href={`/${lang}/r/${r.id}`} className="font-medium hover:underline">{r.number > 1 ? `${A.followup}: ` : ""}{r.title ?? r.question ?? "…"}</Link>
                  <button className="shrink-0 text-xs underline" onClick={() => del("report", r.id)}>{A.deleteReport}</button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {me.reports.filter((r) => !r.chat_id).length > 0 && (
        <div className="card p-5">
          <p className="mb-2 text-sm text-ink-soft">{A.chatDeleted}</p>
          <ul className="space-y-2">{me.reports.filter((r) => !r.chat_id).map((r) => (
            <li key={r.id} className="flex justify-between gap-2"><Link className="hover:underline" href={`/${lang}/r/${r.id}`}>{r.title ?? "…"}</Link><button className="text-xs underline" onClick={() => del("report", r.id)}>{A.deleteReport}</button></li>
          ))}</ul>
        </div>
      )}
      <button className="text-sm text-tomato-dark underline" onClick={() => del("account")}>{A.deleteAccount}</button>
    </div>
  );
}
