"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import type { Dict } from "@/lib/i18n/dictionaries";
import { locales, localeNames, type Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/fmt";
import { parseText, ParseError } from "@/lib/chat/parse";
import { computeStats } from "@/lib/chat/stats";
import type { ParsedChat } from "@/lib/chat/types";
import { extractFrames } from "@/lib/chat/frames";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Avatar } from "./Avatar";
import { AppBadge, APP_KEYS, appLabel } from "./AppIcons";
import { Arrow } from "@/components/Arrow";

type Step = "context" | "source" | "upload" | "me" | "details" | "email" | "writing";
const STEPS: Step[] = ["context", "source", "upload", "me", "details", "email", "writing"];
const CONTEXTS = ["partner", "friends", "friend", "family", "work", "other"] as const;
const CTX_EMOJI: Record<string, string> = { partner: "💌", friends: "😂", friend: "🫶", family: "🏡", work: "📋", other: "🤷" };
const MAX_BYTES = 200 * 1024 * 1024;

interface Saved { attemptId?: string; secret?: string; chatId?: string; context?: string; source?: string }
const KEY = "nana_flow";
const load = (): Saved => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
const save = (s: Saved) => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };

function track(name: string, attemptId?: string, props?: Record<string, unknown>) {
  fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, attemptId, props }), keepalive: true }).catch(() => {});
}

async function decode(buf: ArrayBuffer): Promise<string> {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

async function readExport(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const b = new Uint8Array(buf);
  if (b[0] === 0x50 && b[1] === 0x4b) {
    const zip = await JSZip.loadAsync(buf);
    const entries = Object.values(zip.files).filter((f) => !f.dir && /\.(txt|json|csv)$/i.test(f.name) && !f.name.startsWith("__MACOSX"));
    if (!entries.length) throw new ParseError("no_text_in_zip");
    let best = entries[0], bestSize = 0;
    for (const e of entries) {
      const size = (await e.async("uint8array")).length;
      if (/_chat\.txt$|chat/i.test(e.name)) { best = e; break; }
      if (size > bestSize) { best = e; bestSize = size; }
    }
    return decode((await best.async("uint8array")).buffer as ArrayBuffer);
  }
  return decode(buf);
}

async function gzipJson(obj: unknown): Promise<Blob> {
  const stream = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

export function StartFlow({ lang, t }: { lang: Locale; t: Dict }) {
  const F = t.flow;
  const router = useRouter();
  const sb = useMemo(() => supabaseBrowser(), []);
  const [step, setStep] = useState<Step>("context");
  const [saved, setSaved] = useState<Saved>({});
  const [signedIn, setSignedIn] = useState(false);
  const [parsed, setParsed] = useState<ParsedChat | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [reportLang, setReportLang] = useState<Locale>(lang);
  const [heat, setHeat] = useState<"gentle" | "spicy" | "savage">("spicy");
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [recParts, setRecParts] = useState<string[] | null>(null);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const s = load();
    setSaved(s);
    sb.auth.getSession().then((r: { data: { session: unknown } }) => setSignedIn(!!r.data.session));
    const resume = new URLSearchParams(window.location.search).get("resume");
    if (resume && s.chatId) setStep("email");
  }, [sb]);

  const update = (p: Partial<Saved>) => { const n = { ...saved, ...p }; setSaved(n); save(n); };
  const go = (s: Step) => { setErr(null); setStep(s); track(`step_${s}`, saved.attemptId); window.scrollTo({ top: 0 }); };

  async function chooseContext(context: string) {
    setBusy("ctx");
    const r = await fetch("/api/attempts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context, locale: lang }) });
    setBusy(null);
    if (!r.ok) return setErr(t.common.error);
    const { id, secret } = await r.json();
    const n = { attemptId: id, secret, context, chatId: undefined };
    setSaved(n); save(n);
    track("step_context_done", id, { context });
    go("source");
  }

  async function onFile(file: File) {
    setErr(null);
    if (file.size > MAX_BYTES) return setErr(F.upload.errors.big);
    try {
      setBusy("read");
      await new Promise((r) => setTimeout(r, 30));
      const text = await readExport(file);
      const chat = parseText(text, saved.source);
      const real = chat.messages.filter((m) => m.k !== "system");
      if (real.length < 10) { setBusy(null); return setErr(F.upload.errors.few); }
      setParsed(chat);
      const stats = computeStats(chat.messages);
      setBusy("upload");
      const reg = await fetch(`/api/attempts/${saved.attemptId}/upload`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: saved.secret, source: saved.source ?? chat.source, title: chat.title, participants: chat.participants,
          messageCount: real.length, firstAt: stats.firstAt, lastAt: stats.lastAt, stats, lang: reportLang,
        }),
      });
      if (!reg.ok) throw new Error("register");
      const { chatId, path, token } = await reg.json();
      const blob = await gzipJson({ messages: chat.messages });
      const { error } = await sb.storage.from("chats").uploadToSignedUrl(path, token, blob, { contentType: "application/gzip" });
      if (error) throw new Error("upload");
      update({ chatId });
      track("upload_done", saved.attemptId, { messages: real.length, participants: chat.participants.length, source: chat.source });
      setBusy(null);
      go(chat.participants.length > 0 ? "me" : "details");
    } catch (e) {
      setBusy(null);
      track("upload_error", saved.attemptId, { error: String(e).slice(0, 120) });
      setErr(e instanceof ParseError ? F.upload.errors.format : F.upload.errors.upload);
    }
  }

  async function onVideo(file: File) {
    setErr(null);
    try {
      setBusy("frames"); setPct(0);
      const { zip, count } = await extractFrames(file, setPct);
      if (count < 2) throw new Error("video");
      setBusy("vision");
      const post = (b: object) => fetch(`/api/attempts/${saved.attemptId}/recording`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: saved.secret, ...b }),
      });
      const s = await post({ action: "sign" });
      if (!s.ok) throw new Error("sign");
      const { path, token } = await s.json();
      const { error } = await sb.storage.from("chats").uploadToSignedUrl(path, token, zip, { contentType: "application/zip" });
      if (error) throw new Error("upload");
      const r = await post({ action: "read", path, source: saved.source, lang: reportLang });
      if (r.status === 422) { setBusy(null); return setErr(F.recording.errFew); }
      if (!r.ok) throw new Error("read");
      const { chatId, participants } = await r.json();
      update({ chatId });
      setParsed(null); setRecParts(participants); setMe("Me");
      track("recording_done", saved.attemptId, { frames: count });
      setBusy(null);
      go("details");
    } catch (e) {
      setBusy(null);
      track("recording_error", saved.attemptId, { error: String(e).slice(0, 120) });
      setErr(String(e).includes("video") ? F.recording.errVideo : F.upload.errors.upload);
    }
  }

  async function saveDetails() {
    setBusy("details");
    await fetch(`/api/chats/${saved.chatId}/details`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: saved.secret, meName: me, notes, lang: reportLang }),
    });
    setBusy(null);
    if (signedIn) await startPreview();
    else go("email");
  }

  async function sendCode() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr(F.email.errors.email);
    setBusy("send");
    const { error } = await sb.auth.signInWithOtp({
      email, options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/${lang}/auth/callback?next=${encodeURIComponent(`/${lang}/start?resume=1`)}` },
    });
    setBusy(null);
    if (error) return setErr(/rate|seconds/i.test(error.message) ? F.email.errors.rate : t.common.error);
    setCodeSent(true); setErr(null);
    track("otp_sent", saved.attemptId);
  }

  async function verify() {
    setBusy("verify");
    const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(null);
    if (error) return setErr(F.email.errors.code);
    setSignedIn(true);
    track("otp_verified", saved.attemptId);
    await startPreview();
  }

  async function startPreview() {
    go("writing");
    const r = await fetch(`/api/chats/${saved.chatId}/preview`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: saved.secret, heat }),
    });
    if (!r.ok) { setErr(t.common.error); return go("details"); }
    const { reportId } = await r.json();
    sessionStorage.removeItem(KEY);
    router.push(`/${lang}/r/${reportId}`);
  }

  const idx = STEPS.indexOf(step);
  const total = signedIn ? 6 : 7;
  const appName = appLabel(saved.source ?? "whatsapp");
  const guide = (F.guides as Record<string, string[]>)[saved.source ?? "other"] ?? F.guides.other;
  const found = parsed ? parsed.messages.filter((m) => m.k !== "system") : [];

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-16">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-cream py-3">
        <button aria-label={F.back} className="chip !px-3" onClick={() => (idx > 0 && step !== "writing" ? go(STEPS[Math.max(0, idx - (step === "details" && !parsed?.participants.length ? 2 : 1))]) : router.push(`/${lang}`))}>
          {idx > 0 && step !== "writing" ? (lang === "he" || lang === "ar" ? "→" : "←") : "✕"}
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-paper">
          <div className="h-full bg-tomato transition-all" style={{ width: `${((Math.min(idx, total - 1) + 1) / total) * 100}%` }} />
        </div>
        <span className="text-sm tabular-nums text-ink-soft">{fmt(F.stepOf, { n: Math.min(idx + 1, total), total })}</span>
      </div>

      {err && <p role="alert" className="card mb-4 !bg-blush p-3">{err}</p>}

      {step === "context" && (
        <section className="rise">
          <h1 className="font-display my-6 text-3xl font-bold">{F.context.q}</h1>
          <div className="space-y-3">
            {CONTEXTS.map((c) => (
              <button key={c} disabled={!!busy} onClick={() => chooseContext(c)} className="card flex w-full items-center gap-4 p-4 text-start transition hover:-translate-y-0.5">
                <span className="text-3xl">{CTX_EMOJI[c]}</span>
                <span><span className="block text-lg font-semibold">{F.context.options[c].t}</span><span className="text-sm text-ink-soft">{F.context.options[c].d}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "source" && (
        <section className="rise">
          <h1 className="font-display my-6 text-3xl font-bold">{F.source.q}</h1>
          <div className="grid grid-cols-2 gap-3">
            {APP_KEYS.map((a) => (
              <button key={a} onClick={() => { update({ source: a }); go("upload"); }} className="card flex items-center gap-3 p-4 text-start disabled:opacity-50">
                <AppBadge app={a} size={34} /><span className="font-semibold">{appLabel(a)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "upload" && (
        <section className="rise">
          <h1 className="font-display my-6 text-3xl font-bold">{fmt(F.upload.q, { app: appName })}</h1>
          <input ref={fileRef} type="file" className="hidden" accept=".txt,.zip,.json,.csv,text/plain,application/zip,application/json,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          <button disabled={!!busy} onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
            className="card flex w-full flex-col items-center gap-2 border-dashed p-10 text-center">
            {busy ? (
              <>
                <Avatar size={64} className="animate-bounce" />
                <span className="text-lg font-semibold">{busy === "read" ? fmt(F.upload.reading, { count: "…" }) : busy === "frames" ? fmt(F.recording.extracting, { pct }) : busy === "vision" ? F.recording.reading : F.upload.uploading}</span>
                <span className="text-sm text-ink-soft">{F.upload.readingLocal}</span>
              </>
            ) : (
              <>
                <span className="text-4xl">📎</span>
                <span className="text-lg font-semibold">{F.upload.drop}</span>
                <span className="text-sm text-ink-soft">{F.upload.dropHint}</span>
              </>
            )}
          </button>
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">🔒 {F.upload.privacy}</p>
          <input ref={videoRef} type="file" className="hidden" accept="video/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onVideo(f); e.target.value = ""; }} />
          <div className="card mt-4 p-4">
            <button disabled={!!busy} className="btn btn-ghost w-full !text-base" onClick={() => videoRef.current?.click()}>🎥 {F.recording.cta}</button>
            <p className="mt-2 text-sm text-ink-soft">{F.recording.hint}</p>
          </div>
          <button className="mt-4 text-sm font-semibold underline" onClick={() => setShowGuide((v) => !v)}>{F.upload.howTo}</button>
          {showGuide && (
            <ol className="card mt-3 list-inside list-decimal space-y-1.5 p-4">
              {guide.map((g, i) => <li key={i}>{g}</li>)}
            </ol>
          )}
        </section>
      )}

      {step === "me" && parsed && (
        <section className="rise">
          <p className="card my-4 !bg-sage/30 p-3 text-sm">
            ✓ {fmt(F.upload.found, {
              count: found.length.toLocaleString(lang),
              first: new Date(found[0]?.t ?? 0).toLocaleDateString(lang, { timeZone: "UTC" }),
              last: new Date(found[found.length - 1]?.t ?? 0).toLocaleDateString(lang, { timeZone: "UTC" }),
            })}
          </p>
          <h1 className="font-display mb-1 text-3xl font-bold">{F.me.q}</h1>
          <p className="mb-5 text-ink-soft">{F.me.sub}</p>
          <div className="flex flex-wrap gap-2">
            {parsed.participants.slice(0, 60).map((p) => (
              <button key={p} onClick={() => { setMe(p); go("details"); }} className={`chip ${me === p ? "!bg-butter" : ""}`}>{p}</button>
            ))}
            <button onClick={() => { setMe(null); go("details"); }} className="chip !bg-transparent text-ink-soft">{F.me.none}</button>
          </div>
        </section>
      )}

      {step === "details" && (
        <section className="rise space-y-5">
          <h1 className="font-display mt-6 text-3xl font-bold">{F.details.q}</h1>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} placeholder={F.details.notes}
            className="w-full rounded-xl border-2 border-ink bg-paper px-3 py-2.5" />
          <label className="block">
            <span className="mb-1 block font-semibold">{F.details.lang}</span>
            <select value={reportLang} onChange={(e) => setReportLang(e.target.value as Locale)} className="w-full rounded-xl border-2 border-ink bg-paper px-3 py-2.5">
              {locales.map((l) => <option key={l} value={l}>{localeNames[l]}</option>)}
            </select>
          </label>
          <div>
            <span className="mb-2 block font-semibold">{F.details.heat}</span>
            <div className="grid grid-cols-3 gap-2">
              {(["gentle", "spicy", "savage"] as const).map((h, i) => (
                <button key={h} onClick={() => setHeat(h)} className={`card p-3 text-center ${heat === h ? "!bg-butter" : ""}`} aria-pressed={heat === h}>
                  <div className="text-2xl">{["🥂", "🌶️", "🔥"][i]}</div>
                  <div className="font-semibold">{t.home.heat[h].t}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-ink-soft">{t.home.heat[heat].d}</p>
          </div>
          <button className="btn btn-primary w-full" disabled={!!busy} onClick={saveDetails}>{F.next} <Arrow /></button>
        </section>
      )}

      {step === "email" && (
        <section className="rise space-y-4">
          <h1 className="font-display mt-6 text-3xl font-bold">{F.email.q}</h1>
          <p className="text-ink-soft">{F.email.sub}</p>
          {!codeSent ? (
            <form onSubmit={(e) => { e.preventDefault(); sendCode(); }} className="space-y-3">
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={F.email.placeholder}
                className="w-full rounded-xl border-2 border-ink bg-paper px-3 py-3 text-lg" dir="ltr" />
              <button className="btn btn-primary w-full" disabled={!!busy}>{F.email.send}</button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-3">
              <p>{fmt(F.email.code, { email })}</p>
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border-2 border-ink bg-paper px-3 py-3 text-center font-mono text-2xl tracking-[0.4em]" dir="ltr" />
              <button className="btn btn-primary w-full" disabled={!!busy || code.length < 6}>{F.email.verify}</button>
              <button type="button" className="w-full text-sm underline" onClick={() => { setCodeSent(false); setCode(""); }}>{F.email.resend}</button>
              <p className="text-center text-sm text-ink-soft">{F.email.orLink}</p>
            </form>
          )}
          <p className="text-xs text-ink-soft">
            {F.email.terms.split(/(\{terms\}|\{privacy\})/).map((part, i) =>
              part === "{terms}" ? <Link key={i} className="underline" href={`/${lang}/terms`}>{t.legal.terms}</Link>
                : part === "{privacy}" ? <Link key={i} className="underline" href={`/${lang}/privacy`}>{t.legal.privacy}</Link>
                : <span key={i}>{part}</span>,
            )}
          </p>
        </section>
      )}

      {step === "writing" && <WritingScreen t={t} />}
    </div>
  );
}

export function WritingScreen({ t }: { t: Dict }) {
  const lines = t.flow.writing.lines;
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % lines.length), 2600); return () => clearInterval(id); }, [lines.length]);
  return (
    <section className="rise flex flex-col items-center py-16 text-center">
      <Avatar size={120} className="animate-pulse" />
      <h1 className="font-display mt-6 text-3xl font-bold">{t.flow.writing.t}</h1>
      <p key={i} className="rise mt-3 text-lg">{lines[i]}</p>
      <p className="mt-6 max-w-sm text-sm text-ink-soft">{t.flow.writing.note}</p>
    </section>
  );
}
