/**
 * Credit packs and local prices. 1 credit = 1 full report or 1 follow-up question.
 * Prices are tax-inclusive (Paddle tax_mode "internal") — what you see is what you pay.
 * Amounts are in minor units (cents/agorot); zero-decimal currencies (JPY, KRW) are whole units.
 *
 * Competitive anchor: the original charges ~€12.99 per report with a one-off 50% email
 * discount and has no Israeli pricing. We undercut per report and reward packs.
 */
export const PACKS = [
  { id: "single", credits: 1 },
  { id: "trio", credits: 3 },
  { id: "ten", credits: 10 },
] as const;
export type PackId = (typeof PACKS)[number]["id"];

type Row = { single: number; trio: number; ten: number; half: number };
export const PRICES: Record<string, Row> = {
  USD: { single: 999, trio: 1999, ten: 4999, half: 499 },
  EUR: { single: 999, trio: 1999, ten: 4999, half: 499 },
  GBP: { single: 899, trio: 1799, ten: 4299, half: 449 },
  ILS: { single: 3490, trio: 6990, ten: 16990, half: 1790 },
  AUD: { single: 1499, trio: 2999, ten: 7499, half: 749 },
  CAD: { single: 1399, trio: 2799, ten: 6999, half: 699 },
  NZD: { single: 1599, trio: 3199, ten: 7999, half: 799 },
  CHF: { single: 999, trio: 1999, ten: 4999, half: 499 },
  BRL: { single: 2990, trio: 5990, ten: 14990, half: 1490 },
  MXN: { single: 14900, trio: 29900, ten: 74900, half: 7400 },
  INR: { single: 49900, trio: 99900, ten: 249900, half: 24900 },
  JPY: { single: 1500, trio: 2900, ten: 7500, half: 750 },
  KRW: { single: 13900, trio: 27900, ten: 69900, half: 6900 },
  PLN: { single: 3999, trio: 7999, ten: 19999, half: 1999 },
  SEK: { single: 9900, trio: 19900, ten: 49900, half: 4900 },
  NOK: { single: 9900, trio: 19900, ten: 49900, half: 4900 },
  DKK: { single: 6900, trio: 13900, ten: 34900, half: 3450 },
  CZK: { single: 24900, trio: 49900, ten: 124900, half: 12400 },
  HUF: { single: 389000, trio: 779000, ten: 1949000, half: 194000 },
  TRY: { single: 34900, trio: 69900, ten: 174900, half: 17400 },
  ZAR: { single: 17900, trio: 35900, ten: 89900, half: 8900 },
  SGD: { single: 1299, trio: 2599, ten: 6499, half: 649 },
  HKD: { single: 7900, trio: 15900, ten: 39900, half: 3900 },
  TWD: { single: 29900, trio: 59900, ten: 149900, half: 14900 },
};

const ZERO_DECIMAL = new Set(["JPY", "KRW"]);

const EURO = "AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK".split(" ");
const BY_COUNTRY: Record<string, string> = {
  US: "USD", GB: "GBP", IL: "ILS", AU: "AUD", CA: "CAD", NZ: "NZD", CH: "CHF", BR: "BRL", MX: "MXN", IN: "INR",
  JP: "JPY", KR: "KRW", PL: "PLN", SE: "SEK", NO: "NOK", DK: "DKK", CZ: "CZK", HU: "HUF", TR: "TRY", ZA: "ZAR",
  SG: "SGD", HK: "HKD", TW: "TWD", ...Object.fromEntries(EURO.map((c) => [c, "EUR"])),
};

export function currencyFor(country: string | null | undefined): string {
  return BY_COUNTRY[(country ?? "").toUpperCase()] ?? "USD";
}

export function priceOf(currency: string, pack: PackId, half = false): number {
  const row = PRICES[currency] ?? PRICES.USD;
  return half && pack === "single" ? row.half : row[pack];
}

/** Paddle wants a string amount in the lowest denomination. */
export function paddleAmount(currency: string, minor: number): string {
  return String(minor);
}

export function formatPrice(minor: number, currency: string, locale: string): string {
  const value = ZERO_DECIMAL.has(currency) ? minor : minor / 100;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: ZERO_DECIMAL.has(currency) ? 0 : 2, maximumFractionDigits: ZERO_DECIMAL.has(currency) ? 0 : 2 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export const isPack = (x: unknown): x is PackId => PACKS.some((p) => p.id === x);
export const creditsOf = (pack: PackId) => PACKS.find((p) => p.id === pack)!.credits;

/** The 50% email offer: valid for 48h from the discount email (24h + a "last chance" day). */
export const OFFER_HOURS = 48;
