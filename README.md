# AI-Doctor

A demo clinic web app where an AI drafts a clinical plan from a patient conversation and a licensed doctor must approve it in Postgres before it can become a prescription.

The approval gate is a database constraint, not application logic — the AI path has no INSERT grant on `prescriptions` at all.

[Live demo](https://aidoctor.nvkudva.workers.dev) — [Docs](docs/) — [Screens](#screens)

![Doctor review desk on a tablet: the queue sorted by urgency then longest waiting, each row counting down to the two-hour review target, one case already past it. Seeded demo data.](docs/images/tablet/doctor-reviews.png)

## Screens

Captured from the running app against the seeded database. Phone is 430 x 932,
tablet 900 x 1180 — the doctor desk collapses to a labelled sidebar and a single
column on a phone, and the review queue only splits into queue / case / patient
once a case is open.

### The patient

| | | |
|---|---|---|
| ![Sign-in](docs/images/mobile/login.png) | ![Patient home](docs/images/mobile/patient-home.png) | ![Day-three check-in](docs/images/mobile/patient-checkin.png) |
| **Sign in** — two seeded accounts, no password. | **Home** — the next dose, what is booked, results flagged for a look, and the latest plan. | **Check-in** — three taps, three days after a plan is approved. "Same" or "worse" opens a follow-up rather than a new consult. |
| ![Medicines](docs/images/mobile/patient-medicines.png) | ![Lab results](docs/images/mobile/patient-labs.png) | ![One lab panel](docs/images/mobile/patient-lab-detail.png) |
| **Medicines** — dose times read from the prescription's own timing text; due, taken and missed. | **Labs** — panels, worst-first. | **A result, explained** — the value against its own reference range, one plain sentence, and the readings before it. |

### The doctor

| | |
|---|---|
| ![Doctor home](docs/images/mobile/doctor-home.png) | ![Review queue](docs/images/mobile/doctor-reviews.png) |
| **Home** — the shift: waiting, urgent, longest wait against the two-hour target, decided today. | **Reviews** — only cases awaiting a decision, urgency first, each counting down. |
| ![Case review](docs/images/mobile/doctor-case.png) | ![Appointments](docs/images/mobile/doctor-appointments.png) |
| **A case** — the AI's plan with the validator's verdicts beside it, not buried in the transcript. | **Appointments** — a real day, grouped by clinic session, with attendance. |

### Tablet

| | |
|---|---|
| ![Patient home on a tablet](docs/images/tablet/patient-home.png) | ![Lab detail on a tablet](docs/images/tablet/patient-lab-detail.png) |
| ![Doctor home on a tablet](docs/images/tablet/doctor-home.png) | ![Case review on a tablet](docs/images/tablet/doctor-case.png) |
| ![Appointments on a tablet](docs/images/tablet/doctor-appointments.png) | ![History on a tablet](docs/images/tablet/patient-history.png) |

## Install it

It is a PWA: the manifest ships maskable and Apple touch icons, the shell is
precached, and the app installs to a home screen from Chrome or iOS Safari.
It is served by a static-asset Cloudflare Worker (`apps/web/wrangler.jsonc`),
whose `not_found_handling` answers unmatched paths with the SPA shell.
Clinical traffic is never cached — every `rest`, `rpc`, `functions`, `auth`,
`realtime` and `storage` call is `NetworkOnly`, so a stale queue or a stale plan
cannot be served from disk. Offline you get the shell and a banner saying so.

Regenerate the icon set from the source SVG with `bun apps/web/scripts/make-icons.mjs`.

## Requirements

- [Bun](https://bun.sh) 1.x — the only package manager the scripts use
- Docker — the local Supabase stack runs in it
- [Supabase CLI](https://supabase.com/docs/guides/cli) — Postgres, Auth, Storage, Realtime, Edge Runtime
- A Gemini API key with quota, if you want the AI consult to answer. Without one the UI runs and the review queue works; the consult replies with an error.

## Run it

```bash
git clone https://github.com/nvkudva/AI-Doctor.git
cd AI-Doctor
bun install
cp apps/web/.env.example apps/web/.env.local   # fill in the variables below
bun run db:start                               # prints the API URL and anon key
bun run db:reset                               # applies migrations, then seed.sql
bun run dev                                    # http://localhost:3001
```

The login page should offer "Fake patient" and "Fake doctor" buttons that sign in as seeded users under real RLS.

With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` both unset, the app runs entirely on seeds and `localStorage` — no Docker, no backend.

## Configuration

`apps/web/.env.local` (browser — never put a provider or service-role key here):

| Variable | Required | What it is |
|---|---|---|
| `VITE_SUPABASE_URL` | No | Local or hosted API URL. Unset means offline demo mode. |
| `VITE_SUPABASE_ANON_KEY` | No | Anon key printed by `bun run db:start`. Public by design; RLS enforces access. |
| `VITE_TENANT_SLUG` | Yes | Tenant to act as when the hostname has no subdomain. `citycare` in the seed. |
| `VITE_DEMO_PASSWORD` | No | Shared password for the seeded accounts. Set it to enable the fake-login buttons. |

`supabase/functions/.env` (server, loaded by `bun run db:functions`):

| Variable | Required | What it is |
|---|---|---|
| `GEMINI_API_KEY` | For real AI | Without it the consult and review functions fail. |
| `AI_PROVIDER` | No | Defaults to `stub`; set to the Gemini provider for real model calls. |
| `GEMINI_TEXT_MODEL`, `GEMINI_LIVE_MODEL`, `GEMINI_LIVE_VOICE` | No | Model overrides. |

## How it works

`apps/web/` is a React 19 + Vite 7 PWA with `modules/patient`, `modules/doctor` and `modules/login`. Two interchangeable stores implement the same interface — `store/LocalClinic.tsx` (seeds plus `localStorage`) and `store/SupabaseClinic.tsx` (live) — and `store/ClinicProvider.tsx` picks one based on whether Supabase is configured.

`supabase/functions/` holds three Deno Edge Functions: `ai-consult` runs a patient turn, `ai-review` drives the doctor-side coordinator, and `voice-token` mints a short-lived Gemini Live token. `_shared/agent.ts` rebuilds consult state from Postgres on every turn and runs a deterministic red-flag sweep before any model call.

`supabase/migrations/` is forward-only and carries the authorization layer: `prescriptions.review_id` is `NOT NULL UNIQUE`, a trigger re-checks that the approving review matches the consult, the doctor and the draft hash, and INSERT on `prescriptions` is revoked from `anon`, `authenticated` and `service_role`. Consult state moves through an allowlist table. Tenant isolation is RLS.

## Status

Working: the approval gate, the consult state machine, RLS tenant isolation, the doctor review queue, labs and appointments, and the offline demo store.

Not working or not built:

- The voice leg is not wired up. `voice-token` mints a Live session token, but no client code opens the WebSocket, and no Live tool call is dispatched. The consult today is text.
- The hosted demo has no funded Gemini quota, so the AI consult returns an error there. Everything around it is live against Postgres.
- The hosted demo is a single shared database with open signup and no password on the seeded accounts. There is no reset schedule. Assume anything you write is public and anything you read may have been written by a stranger.
- The pgTAP suites (`supabase/tests/`, covering the gate, transitions and RLS) have never been run against a live database — see `supabase/README.md`. There are no tests for `apps/` or for the Edge Functions.
- `apps/web/src/lib/api/ai.ts` contains a second, unguarded clinical path used in offline demo mode. It hard-codes drug names and doses and none of the server-side guards apply to it. Do not treat its output as clinical content.
- A code review on 2026-09-07 recorded open P0 authorization defects in `voice-token` and `ai-review`. See [REVIEW.md](REVIEW.md) before deploying this anywhere real.

Not a medical device. Demo data throughout; no real patient data, no clinical claims.

## License

No licence file yet — all rights reserved.
