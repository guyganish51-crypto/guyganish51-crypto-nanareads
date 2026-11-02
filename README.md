# What Patrik Thinks

AI chat reports: upload a WhatsApp / Telegram / LINE / KakaoTalk / iMessage export, Patrik (an ex wedding-DJ persona) writes an honest, funny report.

## Stack
- Next.js 16 (App Router, `src/proxy.ts` for locale routing), Tailwind 4
- Supabase (Postgres + Auth email OTP + private Storage bucket `chats`) — project `yuvfujuqoehvmasqunpm` (eu-central-1)
- Vercel hosting + Vercel AI Gateway (OIDC, no AI key needed on Vercel)
- Models: preview `anthropic/claude-haiku-5.5`, full report `anthropic/claude-sonnet-5.5` (override with `PREVIEW_MODEL` / `REPORT_MODEL`)
- Email: Resend HTTP API (optional until `RESEND_API_KEY` is set)
- Payments: not wired yet (credits ledger exists; every new user gets 1 credit). Planned: Paddle.

## Environment variables (Vercel)
| Name | Required | Notes |
| --- | --- | --- |
| `SUPABASE_SECRET_KEY` | yes | Supabase → Project settings → API keys → service_role / secret key |
| `NEXT_PUBLIC_SITE_URL` | yes in prod | e.g. `https://whatpatrikthink.com` |
| `RESEND_API_KEY` | yes | enables report/funnel emails |
| `PADDLE_API_KEY` | payments | server key (Paddle → Developer tools → Authentication) |
| `PADDLE_WEBHOOK_SECRET` | payments | `pdl_ntfset_…` of the notification destination |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | payments | client-side token (`live_…` / `test_…`) |
| `NEXT_PUBLIC_PADDLE_ENV` | payments | `production` or `sandbox` |
| `CRON_SECRET` | optional | Vercel sends it to cron routes automatically |
| `PREVIEW_MODEL`, `REPORT_MODEL`, `TRANSCRIPT_CHAR_BUDGET` | optional | tuning |

## Supabase auth settings (dashboard)
- Auth → URL configuration: Site URL = production URL; add `https://*.vercel.app/**` and the domain to redirect URLs.
- Auth → Email templates → Magic link: include `{{ .Token }}` so users get a 6-digit code.
- Auth → SMTP: use Resend SMTP once the domain is verified (the built-in sender is rate-limited).

## Payments (Paddle, merchant of record)

- No catalog setup: each checkout creates a transaction with a non-catalog, tax-inclusive price from `src/lib/billing/pricing.ts` (24 currencies incl. ILS; picked from `x-vercel-ip-country`).
- Packs: 1 / 3 / 10 credits. 1 credit = full report or follow-up. The 50% email offer applies to the single pack of that report for 48h.
- Webhook: `https://whatpatrikthink.com/api/billing/webhook` — events `transaction.completed`, `adjustment.created`, `adjustment.updated`. Credits are granted idempotently and the report unlocks automatically.
- Paddle dashboard: approve domain `whatpatrikthink.com`, set the default payment link to `https://whatpatrikthink.com/en`.
- Without the env vars the paywall shows "payments open soon" and the discount emails are skipped.

## Email funnel (first report, until unlocked)

0h preview ready → +3h 50% off (24h) → +27h last chance (AI subject) → +51h free for 2 answers → +76h next chat.

## Flow
`/[lang]/start`: context → source → upload (parsed + counted in the browser, gzipped JSON uploaded to a signed Storage URL) → "which one is you" → notes / report language / heat → email OTP → free preview (Haiku) → unlock with a credit (Sonnet) → follow-up questions (new report, 1 credit).

Reports live at `/[lang]/r/{uuid}` (unguessable link = share capability, noindex).
Retention: unclaimed chats 48h, claimed chats 7 days after the latest report (daily cron `/api/cron/cleanup`). Reports stay until deleted.

## i18n
24 locales in `src/lib/i18n/config.ts`, dictionaries in `src/messages/*.json` (English is the source of truth; missing keys fall back to English). Validate with `python3 scripts_check_i18n.py he fr ...`.

## Tests
`node --experimental-strip-types --test tests/parse.test.ts`
