# Nana Reads

AI chat reports: upload a WhatsApp / Telegram / LINE / KakaoTalk / iMessage export, Nana (an 81-year-old grandma persona) writes an honest, funny report.

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
| `NEXT_PUBLIC_SITE_URL` | yes in prod | e.g. `https://nanareads.app` |
| `RESEND_API_KEY` | later | enables report/funnel emails |
| `CRON_SECRET` | optional | Vercel sends it to cron routes automatically |
| `PREVIEW_MODEL`, `REPORT_MODEL`, `TRANSCRIPT_CHAR_BUDGET` | optional | tuning |

## Supabase auth settings (dashboard)
- Auth → URL configuration: Site URL = production URL; add `https://*.vercel.app/**` and the domain to redirect URLs.
- Auth → Email templates → Magic link: include `{{ .Token }}` so users get a 6-digit code.
- Auth → SMTP: use Resend SMTP once the domain is verified (the built-in sender is rate-limited).

## Flow
`/[lang]/start`: context → source → upload (parsed + counted in the browser, gzipped JSON uploaded to a signed Storage URL) → "which one is you" → notes / report language / heat → email OTP → free preview (Haiku) → unlock with a credit (Sonnet) → follow-up questions (new report, 1 credit).

Reports live at `/[lang]/r/{uuid}` (unguessable link = share capability, noindex).
Retention: unclaimed chats 48h, claimed chats 7 days after the latest report (daily cron `/api/cron/cleanup`). Reports stay until deleted.

## i18n
24 locales in `src/lib/i18n/config.ts`, dictionaries in `src/messages/*.json` (English is the source of truth; missing keys fall back to English). Validate with `python3 scripts_check_i18n.py he fr ...`.

## Tests
`node --experimental-strip-types --test tests/parse.test.ts`
