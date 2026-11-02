import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paddle Billing (merchant of record — handles VAT/sales tax, receipts, refunds, Apple Pay,
 * Google Pay, PayPal and cards; onboards Israeli sellers). No catalog setup needed: every
 * checkout is a transaction with a non-catalog price, so prices live in code (pricing.ts).
 *
 * Env: PADDLE_API_KEY (server), PADDLE_WEBHOOK_SECRET (pdl_ntfset_…),
 *      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN (live_…/test_…), NEXT_PUBLIC_PADDLE_ENV = sandbox | production
 */
export const paddleConfigured = () =>
  !!(process.env.PADDLE_API_KEY && process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN && process.env.PADDLE_WEBHOOK_SECRET);

const base = () => (process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com");

async function api<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const r = await fetch(base() + path, {
    method: init.method,
    headers: { authorization: `Bearer ${process.env.PADDLE_API_KEY}`, "content-type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`paddle ${r.status}: ${JSON.stringify(j?.error ?? j).slice(0, 300)}`);
  return j as T;
}

export interface TxnInput {
  name: string; description: string; amountMinor: number; currency: string;
  customData: Record<string, string>;
}

export async function createTransaction(t: TxnInput): Promise<{ id: string }> {
  const body = {
    currency_code: t.currency,
    collection_mode: "automatic",
    custom_data: t.customData,
    items: [{
      quantity: 1,
      price: {
        name: t.name,
        description: t.description,
        tax_mode: "internal",
        unit_price: { amount: String(t.amountMinor), currency_code: t.currency },
        product: { name: t.name, tax_category: "standard", description: t.description },
      },
    }],
  };
  const j = await api<{ data: { id: string } }>("/transactions", { method: "POST", body });
  return { id: j.data.id };
}

/** Paddle-Signature: "ts=…;h1=…" — HMAC-SHA256 over `${ts}:${rawBody}` with the endpoint secret. */
export function verifyWebhook(raw: string, header: string | null, toleranceSec = 300): boolean {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = header.split(";").map((p) => p.split("="));
  const ts = parts.find(([k]) => k === "ts")?.[1];
  const sigs = parts.filter(([k]) => k === "h1").map(([, v]) => v);
  if (!ts || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranceSec) return false;
  const mac = createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex");
  const a = Buffer.from(mac);
  return sigs.some((s) => { const b = Buffer.from(s); return a.length === b.length && timingSafeEqual(a, b); });
}
