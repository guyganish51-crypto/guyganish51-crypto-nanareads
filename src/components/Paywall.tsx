"use client";
import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/fmt";
import { formatPrice } from "@/lib/billing/pricing";
import { Arrow } from "./Arrow";

type PackId = "single" | "trio" | "ten";
interface Prices {
  configured: boolean; currency: string;
  packs: { id: PackId; credits: number; amount: number }[];
  offer: { expiresAt: string; amount: number; was: number } | null;
}

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (e: string) => void };
      Initialize: (o: { token: string; eventCallback?: (e: { name: string; data?: unknown }) => void }) => void;
      Checkout: { open: (o: Record<string, unknown>) => void; close: () => void };
    };
  }
}

const PADDLE_LOCALES = new Set(["ar", "zh-Hans", "zh-Hant", "da", "nl", "en", "fr", "de", "hu", "it", "ja", "ko", "pl", "pt", "ru", "es", "sv", "tr"]);
let paddleReady: Promise<void> | null = null;
let onEvent: ((name: string) => void) | null = null;

function loadPaddle(): Promise<void> {
  if (paddleReady) return paddleReady;
  paddleReady = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.async = true;
    s.onload = () => {
      const P = window.Paddle!;
      if (process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox") P.Environment.set("sandbox");
      P.Initialize({ token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "", eventCallback: (e) => onEvent?.(e.name) });
      resolve();
    };
    s.onerror = () => { paddleReady = null; reject(new Error("paddle_load")); };
    document.head.appendChild(s);
  });
  return paddleReady;
}

function useCountdown(until: string | null) {
  const [left, setLeft] = useState(() => (until ? new Date(until).getTime() - Date.now() : 0));
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setLeft(new Date(until).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  if (!until || left <= 0) return null;
  const s = Math.floor(left / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/**
 * Paywall. With a `reportId` it sells the unlock of that report (and shows the 50% email offer
 * if one is active); without one it just sells credit packs (account page, follow-up questions).
 */
export function Paywall({ t, lang, reportId, credits, onUseCredit, onPaid, source, busy: outerBusy }: {
  t: Dict; lang: string; reportId?: string; credits: number; source: string;
  onUseCredit?: () => void; onPaid: () => void; busy?: boolean;
}) {
  const P = t.report.pay;
  const [prices, setPrices] = useState<Prices | null>(null);
  const [pick, setPick] = useState<PackId>("single");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const paid = useRef(false);
  const [done, setDone] = useState(false);
  const countdown = useCountdown(prices?.offer?.expiresAt ?? null);

  useEffect(() => {
    fetch(`/api/billing/prices${reportId ? `?report=${reportId}` : ""}`).then((r) => r.json()).then(setPrices).catch(() => {});
  }, [reportId]);

  useEffect(() => {
    onEvent = (name) => {
      if (name === "checkout.completed" && !paid.current) {
        paid.current = true;
        setDone(true);
        setMsg(P.processing);
        setTimeout(() => { window.Paddle?.Checkout.close(); onPaid(); }, 1800);
        fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "purchase", props: { pack: pick, source } }) }).catch(() => {});
      }
      if (name === "checkout.error") setMsg(P.failed);
    };
    return () => { onEvent = null; };
  }, [P, onPaid, pick, source]);

  if (credits > 0 && onUseCredit) {
    return (
      <div className="mt-6">
        <button className="btn btn-primary w-full" disabled={outerBusy} onClick={onUseCredit}>{t.report.unlock} <Arrow /></button>
        <p className="mt-2 text-center text-sm text-ink-soft">{fmt(t.report.unlockNote, { n: credits })}</p>
      </div>
    );
  }
  if (!prices) return <div className="mt-6 h-40 animate-pulse rounded-2xl bg-ink/5" />;
  if (!prices.configured) return <p className="mt-6 rounded-xl border-2 border-dashed border-ink/40 p-4 text-center">{P.soon}</p>;

  const cur = prices.currency;
  const price = (m: number) => formatPrice(m, cur, lang);
  const offer = countdown ? prices.offer : null;
  const amountOf = (id: PackId) => (id === "single" && offer ? offer.amount : prices.packs.find((p) => p.id === id)!.amount);
  const label: Record<PackId, string> = { single: P.single, trio: P.trio, ten: P.ten };

  const checkout = async () => {
    setBusy(true); setMsg(null);
    try {
      const [, r] = await Promise.all([loadPaddle(), fetch("/api/billing/checkout", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack: pick, reportId, source }),
      })]);
      if (!r.ok) { setMsg(r.status === 503 ? P.soon : t.common.error); return; }
      const { transactionId, email } = await r.json();
      const locale = PADDLE_LOCALES.has(lang) ? lang : PADDLE_LOCALES.has(lang.split("-")[0]) ? lang.split("-")[0] : lang === "nb" ? "no" : "en";
      window.Paddle!.Checkout.open({
        transactionId,
        customer: email ? { email } : undefined,
        settings: { displayMode: "overlay", theme: "light", locale, allowLogout: false, showAddDiscounts: false },
      });
    } catch { setMsg(t.common.error); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-6">
      {offer && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-tomato px-4 py-3 text-white">
          <span className="font-bold">🔥 {P.offer}</span>
          <span className="font-mono text-lg font-bold tabular-nums" dir="ltr">{countdown}</span>
        </div>
      )}
      <div className="grid gap-2" role="radiogroup" aria-label={P.title}>
        {prices.packs.map((p) => {
          const amt = amountOf(p.id);
          const per = Math.round(amt / p.credits);
          const sel = pick === p.id;
          return (
            <button key={p.id} role="radio" aria-checked={sel} onClick={() => setPick(p.id)}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-start transition ${sel ? "border-ink bg-butter/60 shadow-[3px_3px_0_#221b16]" : "border-ink/25 bg-paper hover:border-ink/60"}`}>
              <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 border-ink ${sel ? "bg-ink" : ""}`}>{sel && <span className="size-2 rounded-full bg-paper" />}</span>
              <span className="flex-1">
                <span className="font-bold">{label[p.id]}</span>
                {p.id === "trio" && <span className="ms-2 rounded-full bg-sage px-2 py-0.5 text-xs font-bold">{P.popular}</span>}
                {p.id === "ten" && <span className="ms-2 rounded-full bg-sky px-2 py-0.5 text-xs font-bold">{P.best}</span>}
                {p.credits > 1 && <span className="block text-xs text-ink-soft">{fmt(P.perReport, { price: price(per) })}</span>}
              </span>
              <span className="text-end">
                {p.id === "single" && offer && <span className="block text-xs text-ink-soft line-through">{price(offer.was)}</span>}
                <span className="font-display text-lg font-bold">{price(amt)}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button className="btn btn-primary mt-4 w-full" disabled={busy || done} onClick={checkout}>
        {reportId ? fmt(P.cta, { price: price(amountOf(pick)) }) : fmt(P.buy, { price: price(amountOf(pick)) })} <Arrow />
      </button>
      {msg && <p className="mt-3 text-center font-semibold">{msg}</p>}
      <ul className="mt-3 space-y-1 text-center text-xs text-ink-soft">
        <li>🔒 {P.trust}</li>
        <li>{P.tax}</li>
        <li>{pick === "single" ? P.refund : P.credits}</li>
      </ul>
    </div>
  );
}
