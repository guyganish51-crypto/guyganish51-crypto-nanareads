"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Dict } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/fmt";
import type { ChatStats } from "@/lib/chat/types";
import type { Preview, Report, Block } from "@/lib/ai/schema";
import { NanaAvatar } from "./NanaAvatar";
import { WritingScreen } from "./StartFlow";

interface Data {
  id: string; chatId: string | null; number: number; status: string; unlocked: boolean; lang: string;
  title: string | null; question: string | null; preview: (Preview & { cutoff?: number | null }) | null; report: Report | null;
  cutoff: number | null; chat: { stats: ChatStats | null; participants: string[]; context: string; messageCount: number; meName: string | null };
  chatAlive?: boolean; isOwner: boolean; credits: number | null;
}

function Blocks({ blocks, me }: { blocks: Block[]; me?: string | null }) {
  return (
    <div className="prose-nana">
      {blocks.map((b, i) =>
        b.type === "p" ? <p key={i}>{b.text}</p> : (
          <div key={i} className={`my-3 flex ${b.author === me ? "justify-end" : "justify-start"}`}>
            <div className={`bubble ${b.author === me ? "" : "bubble-other"}`} dir="auto">
              <div className="text-xs font-semibold text-tomato-dark">{b.author}</div>
              {b.text}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function StatCards({ s, t, lang, pair }: { s: ChatStats; t: Dict; lang: string; pair: boolean }) {
  const S = t.report.stat;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const dur = (m: number | null) => (m == null ? "–" : m < 90 ? fmt(S.min, { n: Math.round(m) }) : fmt(S.h, { n: Math.round(m / 6) / 10 }));
  const top = s.authors.slice(0, pair ? 2 : 4);
  const starters = [...s.authors].sort((a, b) => b.initiationShare - a.initiationShare).slice(0, pair ? 2 : 3);
  const colors = ["bg-sky", "bg-butter", "bg-blush", "bg-sage", "bg-lilac"];
  const Card = ({ k, children, i }: { k: string; children: React.ReactNode; i: number }) => (
    <div className={`rounded-2xl border-2 border-ink p-3 ${colors[i % colors.length]}`}>
      <div className="text-xs font-semibold">{k}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
  const Big = ({ v }: { v: string }) => <div className="font-display text-3xl font-bold">{v}</div>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Card i={0} k={S.messages}><Big v={s.total.toLocaleString(lang)} /></Card>
      <Card i={1} k={S.perDay}><Big v={String(s.perDay)} /></Card>
      <Card i={2} k={S.whoTalks}>{top.map((a) => <div key={a.name} className="flex justify-between gap-2 text-sm"><span className="truncate">{a.name}</span><b>{pct(a.share)}</b></div>)}</Card>
      <Card i={3} k={S.whoStarts}>{starters.map((a) => <div key={a.name} className="flex justify-between gap-2 text-sm"><span className="truncate">{a.name}</span><b>{pct(a.initiationShare)}</b></div>)}</Card>
      {pair && <Card i={4} k={S.reply}>{top.map((a) => <div key={a.name} className="flex justify-between gap-2 text-sm"><span className="truncate">{a.name}</span><b>{dur(a.medianReplyMinutes)}</b></div>)}</Card>}
      <Card i={5} k={S.afterMidnight}><Big v={pct(s.afterMidnightShare)} /></Card>
      <Card i={6} k={S.busiestHour}><Big v={s.busiestHour == null ? "–" : `${s.busiestHour}:00`} /></Card>
      <Card i={7} k={S.voice}><Big v={s.voice.toLocaleString(lang)} /></Card>
      <Card i={8} k={S.emojis}><Big v={s.topEmojis.join(" ") || "–"} /></Card>
      {pair && <Card i={9} k={S.silence}><Big v={fmt(S.days, { n: s.longestSilenceDays })} /></Card>}
    </div>
  );
}

export function ReportView({ id, lang, t }: { id: string; lang: Locale; t: Dict }) {
  const R = t.report;
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [fb, setFb] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/reports/${id}`, { cache: "no-store" });
    if (r.status === 404) return setMissing(true);
    if (r.ok) setD(await r.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!d || !["preview_pending", "full_pending"].includes(d.status)) return;
    const h = setInterval(load, 4000);
    return () => clearInterval(h);
  }, [d, load]);

  if (missing) return <main className="mx-auto max-w-2xl px-4 py-20 text-center"><NanaAvatar size={90} className="mx-auto" /><p className="mt-4 text-lg">{R.notFound}</p></main>;
  if (!d) return <main className="py-24 text-center text-ink-soft">{t.common.loading}</main>;
  if (d.status === "preview_pending") return <main className="mx-auto max-w-xl px-4"><WritingScreen t={t} /></main>;

  const pair = d.chat.participants.length <= 2;
  const p = d.preview;
  const rep = d.report;
  const me = d.chat.meName;

  const share = async () => {
    const url = `${location.origin}/${lang}/r/${d.id}`;
    try {
      if (navigator.share) await navigator.share({ title: d.title ?? "Nana Reads", url });
      else { await navigator.clipboard.writeText(url); setMsg(R.copied); }
    } catch { /* cancelled */ }
  };
  const unlock = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/reports/${d.id}/unlock`, { method: "POST" });
    setBusy(false);
    if (r.status === 402) return setMsg(R.noCredits);
    if (!r.ok) return setMsg(t.common.error);
    load();
  };
  const ask = async () => {
    if (!d.chatId) return;
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/chats/${d.chatId}/followup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, lang: d.lang }) });
    setBusy(false);
    if (r.status === 402) return setMsg(R.noCredits);
    if (r.status === 410) return setMsg(R.askExpired);
    if (!r.ok) return setMsg(t.common.error);
    const { reportId } = await r.json();
    location.href = `/${lang}/r/${reportId}`;
  };
  const sendFb = async (v: string) => {
    setFb(v);
    fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "report_feedback", message: v, meta: { reportId: d.id } }) });
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8" dir="auto">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl" dir="auto">{rep?.title ?? p?.title ?? d.title}</h1>
      {d.question && <p className="mt-2 text-ink-soft">❓ {d.question}</p>}
      <div className="mt-4 flex items-center gap-3">
        <NanaAvatar size={52} />
        <div><div className="font-semibold">{R.by}</div><div className="text-sm text-ink-soft">{R.tagline}</div></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost !py-2 !text-sm" onClick={share}>↗ {R.share}</button>
        <span className="text-xs text-ink-soft">🔒 {R.privacy}</span>
      </div>
      {msg && <p className="card mt-4 !bg-butter/60 p-3">{msg}</p>}
      {d.cutoff && <p className="mt-4 rounded-xl border-2 border-dashed border-ink/40 p-3 text-sm text-ink-soft">{fmt(R.cutoff, { date: new Date(d.cutoff).toLocaleDateString(lang, { timeZone: "UTC" }) })}</p>}

      {d.status === "failed" && <div className="card mt-6 p-5"><p>{R.failed}</p></div>}

      {!rep && p && (
        <>
          <div className="prose-nana mt-6"><p>{p.opening}</p></div>
          {d.chat.stats && (
            <section className="mt-8">
              <h2 className="font-display mb-3 text-2xl font-bold">{R.statsTitle}</h2>
              <StatCards s={d.chat.stats} t={t} lang={lang} pair={pair} />
            </section>
          )}
          <section className="card mt-8 p-5">
            <p className="font-display text-xl font-semibold">🫖 {p.verdict_teaser}</p>
            <h2 className="mt-5 mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">{R.lockedTitle}</h2>
            <ul className="space-y-2">{p.sections.map((s, i) => <li key={i} className="flex gap-2"><span>{s.emoji}</span><span className="font-semibold">{s.heading}</span><span className="ms-auto">🔒</span></li>)}</ul>
            {p.people.length > 0 && <>
              <h2 className="mt-5 mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">{R.peopleTitle}</h2>
              <ul className="space-y-1.5">{p.people.map((x, i) => <li key={i}><b>{x.name}</b> — {x.title}</li>)}</ul>
            </>}
            {d.isOwner && d.status === "preview_ready" && (
              <div className="mt-6">
                <button className="btn btn-primary w-full" disabled={busy} onClick={unlock}>{R.unlock} →</button>
                <p className="mt-2 text-center text-sm text-ink-soft">{fmt(R.unlockNote, { n: d.credits ?? 0 })}</p>
              </div>
            )}
            {d.status === "full_pending" && <p className="mt-6 text-center font-semibold">✍️ {R.writingFull}</p>}
          </section>
        </>
      )}

      {rep && (
        <article className="mt-6">
          {d.status === "full_pending" && <p className="card p-4 text-center font-semibold">✍️ {R.writingFull}</p>}
          <Blocks blocks={rep.opening} me={me} />
          {d.chat.stats && d.number === 1 && (
            <section className="my-8"><h2 className="font-display mb-3 text-2xl font-bold">{R.statsTitle}</h2><StatCards s={d.chat.stats} t={t} lang={lang} pair={pair} /></section>
          )}
          {rep.sections.map((s, i) => (
            <section key={i} className="mt-10">
              <div className="text-3xl">{s.emoji}</div>
              <h2 className="font-display mt-1 text-2xl font-bold leading-snug">{s.heading}</h2>
              <Blocks blocks={s.blocks} me={me} />
            </section>
          ))}
          {rep.people.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display mb-4 text-2xl font-bold">🪞 {R.peopleSection}</h2>
              <div className="space-y-5">
                {rep.people.map((x, i) => (
                  <div key={i} className="card p-5">
                    <h3 className="text-lg font-bold">{x.name}</h3>
                    <p className="text-sm font-medium text-tomato-dark">{x.title}</p>
                    <Blocks blocks={x.blocks} me={me} />
                  </div>
                ))}
              </div>
            </section>
          )}
          {rep.glossary.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display mb-4 text-2xl font-bold">📖 {R.glossary}</h2>
              <dl className="space-y-3">{rep.glossary.map((g, i) => <div key={i}><dt className="font-bold">“{g.term}”</dt><dd className="text-ink-soft">{g.meaning}</dd></div>)}</dl>
            </section>
          )}
          {rep.awards.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display mb-4 text-2xl font-bold">🏆 {R.awards}</h2>
              <ul className="space-y-3">{rep.awards.map((a, i) => <li key={i} className="card p-4"><b>{a.award}</b> → {a.winner}<p className="text-sm text-ink-soft">{a.why}</p></li>)}</ul>
            </section>
          )}
          {rep.reactions.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display mb-4 text-2xl font-bold">🔮 {R.reactions}</h2>
              <ul className="space-y-2">{rep.reactions.map((a, i) => <li key={i}><b>{a.name}:</b> {a.prediction}</li>)}</ul>
            </section>
          )}
          <section className="card mt-12 !bg-butter/40 p-6">
            <h2 className="font-display mb-2 text-2xl font-bold">⚖️ {R.verdict}</h2>
            <div className="prose-nana"><p>{rep.verdict.roast}</p><p>{rep.verdict.heart}</p></div>
            <p className="font-display mt-3 text-xl font-semibold">{rep.verdict.last_line}</p>
          </section>
          {rep.advice && (
            <section className="mt-8"><h2 className="font-display mb-2 text-2xl font-bold">🫖 {R.advice}</h2><div className="prose-nana"><p>{rep.advice}</p></div></section>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={share}>↗ {R.share}</button>
            <span className="text-sm">{R.feedback}</span>
            {fb ? <span className="text-sm">{R.thanks}</span> : <>
              <button className="chip text-sm" onClick={() => sendFb("yes")}>👍 {R.feedbackYes}</button>
              <button className="chip text-sm" onClick={() => sendFb("no")}>👎 {R.feedbackNo}</button>
            </>}
          </div>
          {d.isOwner && d.status === "full_ready" && (
            <section className="card mt-10 p-5">
              <h2 className="font-display text-xl font-bold">{R.askTitle}</h2>
              {d.chatAlive ? <>
                <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} maxLength={500} placeholder={R.askPlaceholder}
                  className="mt-3 w-full rounded-xl border-2 border-ink bg-paper px-3 py-2.5" />
                <button className="btn btn-primary mt-3" disabled={busy || q.trim().length < 5} onClick={ask}>{R.askCta}</button>
              </> : <p className="mt-2 text-ink-soft">{R.askExpired}</p>}
            </section>
          )}
        </article>
      )}

      <p className="mt-10 text-xs text-ink-soft">{R.aiNote}</p>
      <section className="mt-10 text-center">
        <h2 className="font-display text-2xl font-bold">{R.nextTitle}</h2>
        <Link href={`/${lang}/start?from=report_end`} className="btn btn-primary mt-4">{R.nextCta} →</Link>
      </section>
    </main>
  );
}
