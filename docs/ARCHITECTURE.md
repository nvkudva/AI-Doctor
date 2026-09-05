# Virtual Doctor — Architecture Document (Source of Truth)

**Version:** 1.9 (v1.1 aligned to PRD v0.2 — MVP-0/MVP-1 ladder, RA-1 gate, lifecycle edge cases, Consult Trace; v1.2 absorbs PRD UI-1 responsive layout + UI-2 native-shell readiness; v1.3 adds the `LlmProvider` seam, prompt rollout/rollback, Consult Trace scaling plan, and the phase dependency graph; v1.4 adds §11.4 PWA instant-load/app-shell/preload architecture, AP-8, DEC-17/DEC-18; v1.5 renames the "Doctor Desk" app to **Doctor App / Doctor PWA** — folder `apps/doctor/`; v1.6 merges in decisions made on `main` in parallel — DEC-1 domain scheme changes to one subdomain + path-scoped apps (`⟨slug⟩.vd.app/patient` \| `/doctor`, superseding the earlier two-subdomain scheme, with §5.1/§5.2/DEC-12 updated for the shared-origin session model), DEC-2 voice provider changes to Deepgram + Google Chirp 3 HD, and §13 Compliance is removed pending a later re-add; v1.7 reframes the product topology from **two separate PWAs** to **one single PWA with per-module entry points** (patient, doctor, future pharmacy), each selected by a URL path segment, sharing a configurable app shell (`AppShell`) + `packages/ui` while retaining full per-module UI customization — one Vite build, one deploy, with route/module-level lazy-loading so a module never downloads another module's chunk; adds DEC-19 (single-build module topology, CI import-boundary + per-module size budget), rewrites §1.1/§4/§5.1, and reconciles DEC-12/DEC-15/DEC-17 and §12 to one deployment — no product-scope change; v1.8 switches the default LLM from Anthropic `claude-fable-5` to Google **`gemini-2.5-flash`** on cost grounds (DEC-11), renaming the `LlmProvider` MVP adapter `anthropic.ts` → `gemini.ts` and updating §1.3 seam 6, the tech table, the diagram, `ai_config.model` default, and DEC-8/Phase-6 photo vision to Gemini — the `LlmProvider` seam is unchanged, only the shipped adapter; v1.9 switches the monorepo toolchain from npm workspaces to **Bun** (package/script manager) + **Turborepo** task caching per **ADR 001** — build-time only, Vite/Vitest/Deno unchanged — updating the §3 Monorepo + CI rows; v2.0 absorbs PRD §5.0.1 — the shared, configurable AI-voice-agent consultation interface: adds **`MiraConsole`** (§10.4, the one voice-agent surface hosting `MiraPresence` + transcript + a configurable per-audience suggestion/action slot, with minimize-to-orb ⇄ maximized presentations and an `AppShell`-level floating overlay), an inventory row in §10.2, and reconciles Phase 5's deliverable wording — no new seam, `MiraConsole` composes the existing `MiraPresence` (§10.3) + `packages/voice` (§6.4) seams)
**Date:** 2026-07-08
**Status:** Active — this document governs all implementation work.
**Companion:** `docs/PRD.md` v0.5 (product requirements). Where this document and the PRD conflict on *how* to build, this document wins; on *what* to build, the PRD wins.

---

## 0. How to use this document (read first, every agent)

This document is the **single source of truth** for every agent (human or AI) building Virtual Doctor. Rules of engagement:

1. **Do not invent architecture.** If something you need is not specified here, it is either (a) intentionally deferred — check §12 phases and §14 deferred decisions — or (b) a gap. For gaps, propose an addition to this document *before* writing code that depends on it.
2. **Do not duplicate.** Before creating any component, hook, utility, type, or schema, search `packages/*` for an existing one (§10 lists the canonical inventory). Extending an existing shared unit is always preferred over creating a parallel one.
3. **Build only the current phase.** Each phase in §12 has explicit goals, deliverables, acceptance checks, and a "do not build yet" list. Building ahead of phase is a defect, not initiative.
4. **Contracts are law.** The Zod schemas in `packages/core` (§8.3) and the DB schema + RLS (§9) are the interfaces between workstreams. Changing a contract requires updating this document and the schema in the same change.
5. **Never over-engineer.** The bar: could the MVP ship without this abstraction? If yes, and it isn't listed as a deliberate seam (§1.3), don't build it.

---

## 1. High-Level Architecture

### 1.1 System at a glance

```
                        ┌────────────────────────────────────────────┐
                        │        One PWA · per-module entry points   │
                        │  /patient module      /doctor module       │
                        │  ⟨slug⟩.vd.app/patient  ⟨slug⟩.vd.app/doctor │
                        └──────┬───────────────────────┬─────────────┘
             HTTPS / WSS       │                       │
        ┌──────────────────────┼───────────────────────┼──────────────────┐
        │                      ▼                       ▼                  │
        │   ┌─────────────────────────────────────────────────────────┐   │
        │   │              Supabase (single project)                  │   │
        │   │                                                         │   │
        │   │  Auth (Google OAuth patients, email/pw doctors)         │   │
        │   │  Postgres + RLS (all domain data, tenant isolation)     │   │
        │   │  Realtime (doctor queue updates)                        │   │
        │   │  Storage (consult images, per-hospital buckets)         │   │
        │   │  Edge Functions (Deno):                                 │   │
        │   │    • ai-consult     — Mira orchestrator (both modes)    │   │
        │   │    • voice-token    — mints short-lived STT/TTS tokens  │   │
        │   │    • tenant-manifest— per-hospital PWA manifest         │   │
        │   └───────────────┬─────────────────────────────────────────┘   │
        │                   │ server-side only (keys never in browser)    │
        └───────────────────┼──────────────────────────────────────────── ┘
                            ▼
        ┌───────────────┐  ┌───────────────┐  ┌────────────────┐
        │  Google       │  │ Streaming STT │  │ Streaming TTS  │
        │  Gemini API   │  │ (Deepgram)    │  │ (Google Chirp  │
        │               │  │               │  │  3 HD)         │
        └───────────────┘  └───────────────┘  └────────────────┘
```

Audio streams flow **directly between the browser and the voice provider** over WebSocket using short-lived scoped tokens minted by `voice-token` — the Edge Function is in the control path, not the audio path. This keeps voice latency low and Edge Function cost near zero per audio-second.

### 1.2 Architectural principles

| # | Principle | Consequence |
|---|---|---|
| AP-1 | **Serverless-first, stateless-server** | No servers to manage in MVP. Every Mira turn rebuilds context from Postgres; conversations survive function restarts; horizontal scale is free. |
| AP-2 | **Isolation in the database, not the app** | Postgres RLS is the tenancy boundary. Application code is never trusted for isolation. A bug in a query cannot leak another hospital's data. |
| AP-3 | **Secrets never reach the browser** | All AI/STT/TTS keys live in Edge Function env. Browser gets short-lived scoped tokens only. (Replaces the prototype's localStorage key.) |
| AP-4 | **One persona, many agents** | Mira's multi-agent internals (§7) never leak into UX. Same voice, same name, no hand-off language. |
| AP-5 | **Human-in-the-loop is structural** | The `prescriptions` table is only writable through the doctor-approval flow. The AI physically cannot publish a prescription. |
| AP-6 | **Voice pipeline is avatar-ready** | Word timestamps and (where available) visemes flow through the pipeline from day one, even though the orb ignores them (PRD §6.5). |
| AP-7 | **Config over code for tenancy and agents** | New hospital = DB row. New agent = config entry. Neither is a deploy. |
| AP-8 | **App-shell first, not page-first** | The shell (chrome, theme tokens, `AppShell`, `MiraPresence` placeholder) is precached and paints from cache before any network call resolves; screens are reached by client-side navigation with speculative preloading, never a full page load. This is what makes the product feel installed, not browsed (§11.4). |

### 1.3 Deliberate seams (the only places we pre-invest in abstraction)

These are the four abstractions we build *before* we strictly need them, because the PRD marks their evolution as certain, and retrofitting them is a rewrite:

1. **`<MiraPresence>`** — orb today, video avatar later. One component contract (§10.3).
2. **`VoiceProvider` interface** — STT/TTS providers are pluggable adapters (§6.3). Provider choice is a config value.
3. **Agent registry** — agents are config (prompt + model + tools + policies), routed by an orchestrator (§7). Splitting the MVP's single LLM into specialist agents is config, not refactor.
4. **i18n scaffolding** — all user-facing strings go through a message catalog from day one; English is the only shipped locale in MVP (Kannada/Telugu/Hindi later).
5. **Platform capability layer** (`packages/platform`) — PRD UI-2 makes native app containers (Capacitor/TWA) the later-phase end-state, so browser capabilities that differ under a native shell — notifications/push subscription, install prompt, share, persistent storage, in-app back navigation — are accessed only through thin wrappers here, never called raw from components. Mic acquisition already lives behind `packages/voice`. This is wrappers, not a plugin framework: each is a small module with a web implementation today and room for a native one later.
6. **`LlmProvider` interface** (`supabase/functions/_shared/llm/`) — every place the orchestrator calls a model goes through one adapter interface (`complete(prompt, opts): AsyncIterable<Token>` plus a structured-output variant), mirroring `VoiceProvider` (§6.3). MVP ships exactly one adapter, `gemini.ts` (`gemini-2.5-flash`), and nothing else. This is not "multi-model support" — it is the same reversibility bet already made for STT/TTS: the LLM call is the single most expensive and most safety-critical dependency in the system, and it is the one place a vendor or pricing change would otherwise force a rewrite instead of a config change. **No code outside the adapter may reference the Google Gemini SDK, endpoint, or response shape directly** — the orchestrator and agent registry (§7) only ever see the adapter interface.

Everything else follows YAGNI. Specifically **not** abstracted in MVP: no repository pattern over Supabase, no event bus, no microservices, no GraphQL, no custom design-system framework, no monorepo tooling beyond npm workspaces until build times demand it.

---

## 2. Recorded Decisions & Assumptions

PRD v0.2 decided several formerly open questions itself (PRD §9.1) and left the rest open (PRD §9.2). This document adopts the following as **working decisions** — each is reversible at the stated cost. Flag disagreement early; silence is consent.

| # | Decision | Rationale / reversal cost |
|---|---|---|
| DEC-1 | Domain scheme: **one subdomain per hospital, modules as path segments** — `⟨slug⟩.vd.app/patient` and `⟨slug⟩.vd.app/doctor` (extensible to future modules, e.g. `/pharmacy`). One wildcard cert/DNS entry covers all tenants; the subdomain resolves the tenant, the first path segment selects the module within the single PWA (DEC-19). The apex domain is an env value (`VITE_VD_DOMAIN`), no code depends on a literal domain. | Decided in PRD review (PRD §9.1) — one wildcard entry instead of two per tenant, and all modules share an origin (simpler cookie/session model, §5.2). Reversal: DNS + routing-rule change only. |
| DEC-2 | Voice providers: **Deepgram** (streaming STT, Nova-3 model) + **Google Chirp 3 HD** (streaming TTS) as MVP defaults. Both behind the `VoiceProvider` interface. Browser Web Speech API is a dev/demo fallback only. | Decided in PRD review (PRD §9.1): Deepgram's signup credit covers MVP-0 pilot volume outright; Chirp 3 HD's free tier (1M characters/month) covers ~250 five-minute consults/month at no cost with strong voice quality; per-consult cost ~₹6–12. Reversal: implement one adapter file — e.g. to Sarvam AI for Indic-native TTS once the language fast-follows (§9.1) are underway. |
| DEC-3 | **Transcripts only** — raw patient audio is never persisted in MVP. | Lighter privacy burden (PRD rec). Reversal: add a storage sink to the STT adapter + consent copy. |
| DEC-4 | **English only at launch**, all strings through the i18n catalog. | PRD rec. Reversal: add locale files. |
| DEC-5 | In-app status is the required notification channel; **web push ships in MVP-1** (not blocking earlier phases). | Push is additive; service worker already exists for PWA. |
| DEC-6 | **Shared hospital-wide review queue**; no doctor routing/specialty assignment in MVP. | PRD rec. Reversal: add `assigned_doctor_id` column + filter. |
| DEC-7 | Doctor app coordinator-mode **voice ships in MVP-1** (Doctor app launches visual-first in MVP-0). | Decided in PRD §9.1 — reuses the proven patient voice stack. |
| DEC-8 | **Patient photo sharing ships in MVP-1**, analyzed via Gemini vision; video deferred. | Decided in PRD §9.1 — not part of the smallest loop-validating build. |
| DEC-9 | Package manager **npm** (workspaces); **no Turborepo** until cold build exceeds ~60 s. | Smallest tool surface. Reversal: add turbo.json, zero code change. |
| DEC-10 | Target market is **India-first** (₹ economics in PRD): compliance baseline is DPDP Act 2023 + Telemedicine Practice Guidelines 2020, with ABDM and HIPAA as design considerations, not deliverables (compliance section removed for now — to be re-added). | Reversal: compliance section widens; architecture already accommodates it. |
| DEC-11 | Model: `gemini-2.5-flash` primary (Google Gemini — chosen over Claude on cost), per-hospital override via `hospitals.ai_config.model` (e.g. a hospital may pin `gemini-2.5-pro`). Vision (photo analysis) uses the same model. | PRD A-2; cost-driven default. |
| DEC-12 | Hosting: the single PWA (DEC-19) is a **static build on Cloudflare Pages** (one project) fronted by the wildcard tenant subdomain; the client-side router maps the first path segment (`/patient`, `/doctor`, …) to a module (default project domain in MVP-0, wildcard tenant subdomain wired in MVP-1 per DEC-1). A history-fallback rule rewrites unknown paths to the app shell so deep links into any module resolve. Supabase for everything else. | Reversal: any static host with SPA history-fallback works — the build is a pure static bundle. |
| DEC-13 | Lifecycle timers (review SLA, abandonment, expiry — PRD §3A.5) run as **`pg_cron` jobs inside Postgres** calling SQL functions that write `consult_events` and flip statuses. No external scheduler, no queue infrastructure. | Timers are per-hospital config read from `hospitals.ai_config`. Reversal: swap cron jobs for a worker — the SQL functions stay. |
| DEC-14 | **One open consult per patient per hospital** (PRD §3A.5) enforced by a **partial unique index** on `consults (patient_id, hospital_id) WHERE status IN ('active','pending_review')` — database-level, like all other invariants. | App code treats the conflict as "resume existing consult". Reversal: drop the index. |
| DEC-15 | **Responsive strategy (PRD UI-1, MVP-0):** mobile-first CSS with **two canonical breakpoints** — `tablet ≥ 768px`, `desktop ≥ 1120px` — defined once in `packages/theme` (exported TS consts + documented media-query snippets) and used by name everywhere. Page-level reflow is owned by layout components (`AppShell`, the Doctor app's review layout): stacked single-column on phone → two/three-pane on desktop. **No user-agent/device sniffing, no separate mobile builds** — one build for the whole PWA, CSS decides layout. | Two breakpoints cover phone/tablet/desktop per UI-1 without a grid-system dependency. Reversal: add a breakpoint constant. |
| DEC-16 | **Native-shell readiness (PRD UI-2, later phase):** target wrapper is **Capacitor** (one codebase → Play Store + App Store; TWA remains an Android-only alternative). Binding MVP rules so this stays a packaging task, not a rewrite: (a) no browser-only APIs without a native equivalent in load-bearing paths; (b) platform capabilities only via `packages/platform` (seam 5) / `packages/voice` for mic; (c) UI never assumes browser chrome — every screen reachable via in-app navigation, no reliance on the URL bar or browser-back as the only way out; (d) push lands (MVP-1, DEC-5) behind the platform wrapper so web-push can later be joined by FCM/APNs. **No Capacitor dependency, config, or native project is added before its phase.** | Mirrors the avatar pattern: deferred, but the end-state. Reversal: none needed — the rules cost ~zero if the wrap never happens. |
| DEC-17 | **Workbox via `injectManifest`, not `generateSW`** (one service worker for the PWA, `vite-plugin-pwa`), with an explicit per-route-class caching strategy matrix (§11.4) instead of one blanket strategy. `generateSW`'s defaults are tuned for generic sites, not a call-screen voice app with a hard latency budget (§6.1) that must never itself be cached. | `injectManifest` costs one hand-written service worker file vs. config-only, but is the only way to guarantee `NetworkOnly` on consult endpoints while still getting `CacheFirst` instant loads everywhere else. Reversal: switch to `generateSW` + custom runtime caching config — same cost either way, this just names the choice. |
| DEC-18 | **TanStack Query cache persisted to IndexedDB** (`persistQueryClient` + an IndexedDB storage adapter) for stable, non-live data only: hospital theme/config, patient profile, records list/detail. Consult-in-progress and queue data are explicitly excluded — persisted stale data there is a correctness risk, not a UX win. | Makes repeat app launches paint real content immediately from disk instead of a blank shell + spinner while the network round-trips — the single biggest lever for "feels installed, not loading" on a warm return visit. Reversal: drop the persister plugin; TanStack Query still works in-memory-only. |
| DEC-19 | **Single PWA, per-module entry points — one Vite build, one deploy.** Patient, doctor, and future modules (pharmacy, …) are `modules/*` inside one `apps/web` shell, selected by the first URL path segment (DEC-1). They share a configurable app shell (`AppShell` — header/nav/footer, driven by per-module config) and `packages/ui`, while retaining full per-module UI customization. Download isolation ("a module never ships another module's code") is preserved **by code-splitting, not by separate builds**: each module is a route-level lazy chunk, so `/patient` never loads the `/doctor` chunk. Two guardrails make this binding: (a) a **CI import-boundary rule** — `modules/*` may import `apps/web` shell exports and any `packages/*`, but never another `modules/*`; (b) a **per-module initial-JS size budget** (§11) enforced in CI. Per-module PWA installability is preserved via distinct manifest `scope`/`start_url` per module (§5.1), all emitted from the one deployment. | Replaces the earlier "two independent Vite builds / two Cloudflare projects" topology; the isolation goal is unchanged, only its mechanism. Reversal: split a module back into its own `apps/*` Vite app — the shell + `packages/*` seams already make this a config move, not a rewrite. |

---

## 3. Technology Stack (authoritative)

| Layer | Choice | Version pin policy |
|---|---|---|
| Language | TypeScript, `strict: true` everywhere (apps, packages, Edge Functions) | Latest stable minor |
| UI | React 19 + Vite | Pin major |
| Monorepo | **Bun** workspaces (package manager + script runner) + **Turborepo** task caching (ADR 001). Bun is build-time only — it runs Vite/Vitest, it does not replace them, and it never runs `supabase/functions/*` (Deno). | Pin Bun + Turborepo majors |
| Styling | CSS Modules + design tokens as CSS variables (`packages/theme`). **No runtime CSS-in-JS. No Tailwind.** | — |
| Data/state | TanStack Query v5 over `@supabase/supabase-js`; React state/context for UI-local state. **No Redux/Zustand/MobX.** | Pin major |
| Validation | Zod — single schema source in `packages/core`, used by browser *and* Edge Functions | Pin major |
| PWA | `vite-plugin-pwa` (Workbox, `injectManifest` mode — DEC-17), one service worker for the PWA with per-module manifest scopes (§5.1); caching/preload architecture in §11.4 | Pin major |
| Backend | Supabase: Postgres 15+ / RLS, Auth, Realtime, Storage, Edge Functions (Deno) | Managed |
| AI | Google Gemini API, `gemini-2.5-flash`, streaming, structured JSON output | API version pinned in one const |
| STT | Deepgram streaming WS (adapter) | — |
| TTS | Google Chirp 3 HD streaming (adapter) | — |
| Tests | Vitest (unit), Testing Library (component), Playwright (E2E smoke), pgTAP or SQL scripts (RLS tests) | — |
| Lint/format | ESLint (typescript-eslint, react-hooks) + Prettier, single root config in `packages/config` | — |
| CI | GitHub Actions: typecheck + lint + unit tests + build on every PR (run through **Turborepo** cache — only changed packages re-execute), `bun install --frozen-lockfile`; RLS tests on schema changes | — |

**Adding a dependency** to any package requires a one-line justification in the PR description and must not overlap an existing dependency's capability. Bundle-affecting deps must fit the performance budget (§11).

---

## 4. Repository Layout (authoritative)

```
virtual-doctor/
├── apps/
│   └── web/                      # the single PWA — one Vite build, one deploy (DEC-19)
│       ├── src/
│       │   ├── shell/            # AppShell: header/nav/footer, per-module config, layout primitives
│       │   ├── router.tsx        # first path segment → lazy-loaded module (DEC-1)
│       │   ├── main.tsx, app.tsx
│       │   └── modules/
│       │       ├── patient/      # /patient module — route-level lazy chunk
│       │       │   ├── routes/   # (lazy-loaded)
│       │       │   └── features/ # consult/, records/, profile/, onboarding/
│       │       └── doctor/       # /doctor module — route-level lazy chunk
│       │           ├── routes/
│       │           └── features/ # queue/, review/, mira-panel/
│       │                         #   (future: src/modules/pharmacy/, …)
│       ├── index.html
│       └── vite.config.ts        # manualChunks: one chunk per module (download isolation)
├── packages/
│   ├── ui/                       # shared components (§10) — presentational only
│   ├── theme/                    # design tokens, light/dark, per-hospital accent
│   ├── api/                      # typed Supabase client, query/mutation hooks, generated DB types
│   ├── voice/                    # voice engine: mic capture, VoiceProvider adapters,
│   │                             #   turn-taking state machine, audio playback + timestamps
│   ├── core/                     # domain types, Zod schemas, consult state machine, i18n catalog
│   ├── platform/                 # thin wrappers over browser/native capabilities (§1.3 seam 5):
│   │                             #   notifications/push, install prompt, share, persistent storage, back-nav
│   └── config/                   # shared tsconfig/eslint/prettier/vite base
├── supabase/
│   ├── migrations/               # numbered SQL migrations incl. RLS policies
│   ├── functions/
│   │   ├── ai-consult/           # Mira orchestrator (§7)
│   │   ├── voice-token/
│   │   ├── tenant-manifest/
│   │   └── _shared/              # agent registry, prompt assembly, safety rules, contracts,
│   │                             #   llm/ (LlmProvider adapters, §1.3 seam 6) — imports packages/core schemas
│   └── seed/                     # dev seed: 2 hospitals, doctors, sample patients
├── docs/                         # PRD.md, ARCHITECTURE.md (this file), ADRs (docs/adr/NNN-*.md)
└── .github/workflows/
```

**Import rules (enforced by ESLint boundaries):**

- `apps/web` (shell + router) may import any `packages/*`.
- `apps/web/src/modules/*` may import the `apps/web` shell exports and any `packages/*`, but **never another `modules/*`** (DEC-19 import-boundary rule — this is what keeps the module chunks independently splittable and downloadable in isolation). A CI check enforces it in addition to ESLint boundaries.
- `packages/ui` may import `theme` and `core` only — never `api` or `voice` (components receive data and callbacks via props).
- `packages/voice` may import `core` only.
- `packages/api` may import `core` only.
- `packages/platform` may import `core` only. `ui` components never import it — capability calls happen in app/feature code, results flow into `ui` as props (DEC-16).
- `packages/core` imports nothing internal (leaf).
- Edge Functions import Zod contracts from `packages/core` (via the `_shared` bridge); they never import UI/voice/api packages.

---

## 5. Low-Level Architecture

### 5.1 Tenant resolution

*(Design is MVP-0 — every table, policy, and theme token is tenant-scoped from the first migration. Delivery — subdomain + path resolution, per-tenant manifests, onboarding — ships in Phase 6/MVP-1; MVP-0 seeds the single pilot hospital directly and the PWA loads its config by env-configured slug.)*

1. Browser loads `citycare.vd.app/patient` (or `/doctor`). The single PWA's client-side router (DEC-12, DEC-19) maps the first path segment to the correct module and lazy-loads its chunk; the shell then parses the subdomain → slug `citycare` (in `packages/core/tenant.ts`; the *only* place subdomain parsing exists) — the path segment selects the module, it is not something app code re-derives for tenancy.
2. The shell fetches the hospital row (public read of `id, slug, name, logo_url, theme` only — RLS exposes nothing else anonymously) and applies theme tokens by setting CSS variables on `:root`.
3. `tenant-manifest` Edge Function serves a `manifest.webmanifest` **per tenant *and* per module** (name, icons, theme color, and a `scope`/`start_url` of `/patient` or `/doctor`) so each hospital's modules are each independently installable PWAs from the *one* deployment (DEC-19). The distinct manifest `scope` per module is what lets a patient and a doctor install separate home-screen apps despite sharing an origin and a build.
4. The hospital `id` is attached to every consult at creation *server-side* (the Edge Function resolves slug → id itself; the client's claim is never trusted).

### 5.2 Auth & session

- Patients: Supabase Google OAuth. First sign-in triggers the profile wizard (`patient_details` row).
- Doctors: email/password, provisioned by the operator (no self-signup path exists in the UI or API).
- JWT custom claims (set via Supabase auth hook): `role`, and memberships are resolved by RLS via the `memberships` table (not stuffed into the token, so revocation is immediate).
- Session persists across PWA launches (Supabase default localStorage persistence is acceptable). **Under the path-scoped domain scheme (DEC-1), patient and doctor share one origin per hospital** — unlike the earlier two-subdomain design, browser storage is no longer origin-isolated between them. Session/role separation is therefore an **application-level rule, not a browser one**: the Supabase client instance, its localStorage key prefix, and the JWT's `role` claim are namespaced per module (`patient`/`doctor`) so a token issued for one can never be read or reused by the other, and RLS is still the actual authorization boundary (AP-2) regardless. This is checked in the Phase 1 RLS/auth test suite, not assumed from same-origin isolation.

### 5.3 The consult turn (text or voice) — one code path

Every Mira turn, regardless of input mode, is:

```
client ──(POST /ai-consult, {consultId, turn})──▶ Edge Function
  1. authn: verify JWT, verify consult ownership (defense in depth on top of RLS)
  2. context assembly: load patient profile, allergies, prior consults/prescriptions,
     current transcript — all via service role, scoped to this consult's hospital
  3. safety injection: hard rules block (allergies, age/pregnancy constraints,
     red-flag escalation policy) appended server-side; client input can never alter it
  4. orchestrator: route to agent (§7), call Anthropic streaming
  5. stream response: SSE to client — text tokens stream immediately;
     structured JSON tail (note/confidence/flags/done/recommendation) parsed at end
  6. post-validation: recommendation validated against MiraPatientTurn schema AND
     re-checked against the allergy hard-rules (independent code path from the prompt)
  7. persist: consult_messages + ai_drafts written; status transition if done;
     non-message system actions (queued, notification sent, …) land in consult_events —
     nothing bypasses the trace tables (§8.5): if it isn't in the trace, it didn't happen
```

Voice differs only at the edges: STT produces the `turn` text; the streamed reply text is forked to the TTS adapter sentence-by-sentence (§6.2). The consult logic is identical — this is what makes P-3a (mixed voice/text turns) free.

### 5.4 Doctor review flow

- Queue: TanStack Query + Supabase Realtime subscription on `consults` where `status = 'pending_review'` for the doctor's hospital, ordered urgency → age.
- Review screen loads: transcript, latest `ai_drafts` row, patient profile/history panel. Opening a consult records a `doctor_opened` event in `consult_events` (feeds the Consult Trace and the review-time metric).
- Conversational edits (D-9): doctor turn → `ai-consult` in coordinator mode → response `{reply, action: 'edit', recommendation}` → the **draft on screen updates**; nothing persists as a prescription.
- **Approval is an explicit UI action** (button + confirm) that calls a single Postgres RPC `approve_consult(consult_id, final_items, advice)` running as a transaction: inserts `prescriptions`, inserts `reviews` (with diff vs AI draft), flips consult status. This RPC is the *only* write path to `prescriptions` (AP-5). Voice can never trigger it.
- Reject/escalate follow the same RPC pattern (`reject_consult`, `escalate_consult`).

### 5.5 Realtime & offline

- Realtime: doctor queue only (MVP). Patient consult status updates via TanStack Query polling (30 s) + push later — do not add a second Realtime channel until profiling says polling hurts.
- Offline (PWA): app shell + records list/detail cached. Consults require connectivity; the consult screen shows a clear offline state. No offline queueing of consult turns in MVP. Full caching-strategy matrix, preload behavior, and repeat-launch performance are specified in §11.4 — this bullet is the correctness rule (consults never cached); §11.4 is the performance architecture built around it.

### 5.6 Consult lifecycle timers (PRD §3A.5 — MVP-0 requirements)

All timers are `pg_cron` jobs (DEC-13) running SQL functions; every firing writes a `consult_events` row and any status change goes through the same state-machine trigger as everything else (§8.4). Thresholds are per-hospital config (`hospitals.ai_config.sla`), with platform defaults:

| Timer | Default | Action |
|---|---|---|
| Review SLA warn | 2 h in `pending_review` during clinic hours | Notify patient of the delay; escalate to the hospital's admin contact (`sla_escalated` event). |
| Review expiry | 24 h in `pending_review` | Consult → `expired`; apology message + clear in-person guidance to the patient. |
| Abandonment | 30 min in `active` with no patient turn | Consult → `abandoned`; patient can start fresh anytime; Mira may reference the abandoned attempt naturally in the next consult's context assembly. |

The urgent flag is independent of all timers: red-flag guidance is delivered to the patient immediately (P-7), regardless of review latency. Additional lifecycle rules enforced at the database: **one open consult per patient per hospital** (partial unique index, DEC-14 — the app resumes the existing consult instead); a rejected consult always carries the doctor's reason and a concrete next step (rejection is never a dead end); **adults 18+ only** — enforced via DOB at profile completion, stated at onboarding.

---

## 6. Voice Pipeline (the heart of the product)

### 6.1 Latency budget (end-of-speech → first reply audio, target < 1.5 s, ceiling 3 s)

| Segment | Budget |
|---|---|
| STT endpointing (silence detection → final transcript) | ≤ 400 ms |
| Edge Function context assembly + Anthropic time-to-first-sentence | ≤ 700 ms |
| TTS time-to-first-audio (first sentence, streamed) | ≤ 300 ms |
| Network/playback overhead | ≤ 100 ms |

Measured and logged per turn (§11.3). Any change that regresses p50 latency is a defect.

### 6.2 Streaming choreography

1. Mic audio streams browser → Deepgram over WSS (token from `voice-token`, TTL ≤ 60 s, scoped per consult). Interim transcripts render live.
2. End-of-speech (Deepgram endpointing, with tap-to-finish fallback) → final transcript → POST to `ai-consult`.
3. Reply streams back over SSE. The client-side **sentence splitter** (in `packages/voice`) forwards each completed sentence to the TTS adapter immediately — speech starts on sentence 1 while the LLM is still writing sentence 3.
4. TTS adapter returns audio chunks **plus word-level timestamps** (Chirp 3 HD's timepoint support; visemes where provider supports). These feed the `MiraPresence` state machine and are retained in the pipeline for the future avatar (AP-6). The orb consumes only coarse state; the timestamps still flow.
5. Barge-in: if the patient starts speaking while Mira speaks, playback pauses and the turn machine returns to `listening`. (Simple pause, not duplex — good enough for MVP.)

### 6.3 `VoiceProvider` interface (in `packages/voice`)

```ts
interface SttSession {
  start(stream: MediaStream): void;
  onInterim(cb: (text: string) => void): void;
  onFinal(cb: (text: string) => void): void;   // fired on endpointing
  stop(): Promise<void>;
}
interface TtsSession {
  speak(sentence: string): void;                // append to the utterance queue
  onAudio(cb: (chunk: AudioChunk) => void): void;
  onTimestamps(cb: (words: WordTiming[], visemes?: Viseme[]) => void): void;
  flush(): Promise<void>;
  cancel(): void;                               // barge-in
}
interface VoiceProvider {
  createStt(token: string, opts: SttOpts): SttSession;
  createTts(token: string, opts: TtsOpts): TtsSession;
}
```

Adapters: `deepgram.ts`, `chirp.ts`, `webspeech.ts` (dev only). Provider selection comes from hospital config with platform default. **No code outside the adapters may reference a provider SDK or endpoint.**

### 6.4 Turn-taking state machine (in `packages/voice`, consumed by both modules)

States: `idle → listening → thinking → speaking → listening …` with `error` and `ended`. This machine is the single driver of `<MiraPresence>` in both the patient and doctor modules — patient mode and coordinator mode differ only in who is on the other end.

---

## 7. Agent Design (Mira's internals)

### 7.1 Model

An **agent is a config object, not a class hierarchy**:

```ts
interface AgentConfig {
  id: 'receptionist' | 'doctor' | /* phase 2+: */ 'pharmacy' | 'lab' | `specialist:${string}` | 'supervisor' | 'comms';
  model: string;                    // default gemini-2.5-flash
  systemPrompt: (ctx: ConsultContext) => string;   // template, assembled server-side
  tools: ToolName[];                // allowlist from the shared tool registry
  policies: { maxTurns: number; maxTokensPerCall: number };
}
```

The registry lives in `supabase/functions/_shared/agents/`. Per-hospital overrides come from `hospitals.ai_config` (model, voice persona, quota numbers — *not* arbitrary prompt injection; overridable fields are an explicit allowlist).

### 7.2 Orchestrator (`ai-consult` Edge Function)

- Routes each turn by consult status + app: `active` + patient app → patient-mode pipeline; `pending_review` + Doctor app → coordinator mode.
- **MVP simplification (mandated, per PRD §3B.2):** in **MVP-0 the Doctor Agent runs alone** — one LLM call whose intake stage covers the Receptionist's greeting/resume duties. The **Receptionist splits out as its own registry entry in MVP-1** (own prompt stage, same or separate call — config, not refactor). Do not build multi-call agent chains, agent-to-agent messaging, or a planning loop in MVP. The registry seam is what preserves the option (AP-7).
- Merges are trivial in MVP (single agent output). The merge point exists as a named function (`composeMiraTurn`) so specialist opinions have a place to land in phase 2.
- Enforces quotas before calling any provider: max turns/consult, max tokens/call, per-hospital daily consult quota (covers LLM + STT + TTS spend). Quota-exceeded returns a graceful spoken/text wrap-up, never a raw error.

### 7.3 Response contracts (carried over from the prototype, formalized)

All agent outputs must parse against these Zod schemas (`packages/core/contracts.ts`). Parse failure → one automatic re-ask with the validation error appended → then graceful degradation (save transcript, apologize, mark consult `active` for resume). Never show raw JSON or a stack to a user.

```ts
// Patient mode — every turn
MiraPatientTurn = {
  reply: string,                    // spoken/shown text
  note: string,                     // ≤ 7-word clinical note for the transcript margin
  confidence: 'low' | 'medium' | 'high',
  flags: string[],                  // safety flags surfaced to the reviewing doctor
  done: boolean,
  recommendation: Recommendation | null,   // present iff done
  tone?: 'reassuring' | 'concerned' | 'cheerful' | 'neutral',  // reserved for avatar/TTS style (A-8)
}

Recommendation = {
  type: 'prescription' | 'investigation' | 'advice',
  title: string, summary: string,
  items: Array<{ name, dosage, timing, notes, why, detail }>,
  advice: string,
  urgency: 'routine' | 'soon' | 'urgent',
}

// Coordinator mode — every turn
MiraCoordinatorTurn = {
  reply: string,
  action: 'none' | 'edit' | 'answer',      // NOTE: no 'approve' — approval is UI-only (§5.4)
  recommendation: Recommendation | null,    // present iff action === 'edit'
  citations: Array<{ table: 'consults'|'prescriptions'|'consult_messages'|'patient_details', id: string, excerpt: string }>,
}
```

The prototype's `action: 'approve'` is **deliberately removed**: voice can request changes, only the authenticated UI can sign (PRD D-9).

### 7.4 Safety layering (three independent lines)

1. **Prompt-level hard rules** — server-injected, client-immutable: allergy classes forbidden, age/pregnancy constraints, red-flag symptom list → set `urgency: 'urgent'` + spoken emergency guidance.
2. **Post-validation** — independent code (not the LLM) re-checks every recommendation against the patient's structured allergy list and age constraints before it can enter `pending_review`. Violations block the draft and flag the consult.
3. **Human gate** — the doctor approval RPC (§5.4). Structural, not procedural.

Red-flag consults additionally render the emergency interstitial (P-7) immediately, independent of review latency.

### 7.5 Phase-2+ agents (design intent only — do not build in MVP)

Specialists, Lab, Radiology, Pharmacy, Communication Manager, Supervisor slot in as additional registry entries invoked by the orchestrator around the doctor agent (pharmacy = post-draft check; specialist = pre-conclusion consult; comms = post-approval). Their outputs flow through `composeMiraTurn` and are recorded in `ai_drafts.raw_response` with agent attribution. The `mira_feedback` table (§9) is the Supervisor's future input.

---

## 8. Database Design

### 8.1 Choice

**Postgres on Supabase** — relational (consult lifecycle is transactional and relational), RLS is the best-in-class tenancy mechanism for this shape, free tier → predictable paid scaling, and Realtime/Auth/Storage come from the same platform. No second database. JSONB for genuinely polymorphic payloads (AI raw output, prescription items, theme) — never for data we filter or join on.

### 8.2 Schema (authoritative — matches PRD §6.4 with constraints made explicit)

Tables: `hospitals`, `profiles`, `memberships`, `patient_details`, `consults`, `consult_messages`, `review_messages`, `ai_drafts`, `prescriptions`, `reviews`, `mira_feedback`, `consult_media`, `consult_events` — columns exactly as PRD §6.4, plus:

- All PKs `uuid default gen_random_uuid()`; all timestamps `timestamptz default now()`.
- `consults.status` is a Postgres enum — including `abandoned` and `expired` (PRD §3A.5); transitions enforced by trigger against the state machine in §8.4.
- `prescriptions.supersedes_id` self-FK; a superseding insert flips the superseded row's consult status via the same RPC.
- `consult_events` is **append-only** (no UPDATE/DELETE grants to anyone): `event_type` (`status_change`|`queued`|`doctor_opened`|`notification_sent`|`sla_escalated`|`expired`|`system`), `actor` (`patient`|`ai`|`doctor`|`system`), `actor_id`, `payload jsonb`. The status-transition trigger writes the `status_change` events itself, so no code path can change status without leaving a trace row.
- **Partial unique index** `consults (patient_id, hospital_id) WHERE status IN ('active','pending_review')` — one open consult per patient per hospital (DEC-14).
- Indexes (MVP set): `consults(hospital_id, status, created_at desc)` (queue), `consults(patient_id, created_at desc)` (records), `consult_messages(consult_id, created_at)`, `consult_events(consult_id, created_at)`, `prescriptions(patient_id)`, `memberships(profile_id, hospital_id)`.
- Migration discipline: numbered SQL files in `supabase/migrations`, forward-only, each migration ships its RLS changes and a rollback note. Generated TS types (`supabase gen types`) are committed to `packages/api` and CI fails if stale.

### 8.3 RLS policy matrix (the tenancy contract)

| Table | patient | doctor | Edge Fn (service role) |
|---|---|---|---|
| hospitals | read `id,slug,name,logo_url,theme` (anon-visible view) | read own hospitals | all |
| patient_details | own row r/w | read, for patients with a consult in their hospital | all |
| consults | own rows r; insert own | r/w where `hospital_id ∈ memberships` | all |
| consult_messages | own consults r; **insert patient turns only** | read (their hospital) | all |
| review_messages | — | own hospital r/w | all |
| ai_drafts | read latest of own consult (summary fields only) | read (their hospital) | **only writer** |
| prescriptions | own r | own hospital r | insert **via approval RPCs only** |
| reviews, mira_feedback | — | own hospital insert/read | all |
| consult_media | own consults r/w (upload) | read (their hospital) | all |
| consult_events | — | read (their hospital) | **only writer** (service role + SQL functions/triggers); append-only for all |
| consult_trace (view) | — | read (their hospital) | all — operator reads cross-hospital via console (O-3) |

Every table has RLS **enabled with default-deny**; policies are additive grants. RLS tests (§12 Phase 1) assert both the grants and the denials (patient A cannot read patient B; doctor of hospital X cannot read hospital Y — these four negative tests run in CI forever).

### 8.4 Consult state machine (in `packages/core`, mirrored by DB trigger)

```
active → pending_review → approved | rejected | escalated
active → abandoned                (30 min no patient turn — timer, §5.6)
pending_review → expired          (24 h unreviewed — timer, §5.6)
approved → communicated → closed
approved → superseded (via superseding prescription)
```

Any transition not in this list is rejected at the database. UI state derives from this enum only — no shadow status fields. Every transition is also recorded as a `status_change` row in `consult_events` by the same trigger.

### 8.5 Consult Trace read model (PRD §5.4, O-1–O-4 — MVP-0)

The trace is a **read model, not new write paths**: every step of a consult already lands in an append-only table with timestamps and actor attribution (`consult_messages`, `ai_drafts` — with logical-agent attribution, `review_messages`, `reviews`, `consult_media`, `prescriptions`), and `consult_events` covers the transitions and system actions that aren't messages. A single database view unions them:

- **`consult_trace` view**: time-ordered `UNION ALL` over the tables above, normalized to `(consult_id, hospital_id, at, actor, actor_id, kind, summary, payload)`. This view is the *only* thing the trace timeline UI and search read (O-1); free-text search over transcript/draft content (O-2) is a Postgres full-text index over the message/draft sources — no search infrastructure in MVP.
- **Access** follows the RLS matrix (O-3): doctors/admins see their hospital's traces; the operator reads cross-hospital via console/SQL in MVP-0 (the operator dashboard queries in `docs/ops.md` are trace queries); patients see UC-3 record views, never the internal trace.
- **Export** (O-4): one RPC `export_consult_trace(consult_id)` returns the full trace as JSON; the printable view renders the same payload client-side.
- **Invariant**: nothing in any flow may write consult state outside these tables. If it isn't in the trace, it didn't happen — this is checked in review, and the Phase-2 E2E asserts the trace is complete for a full consult lifecycle.
- **Scaling plan (do not build in MVP-0, but name it now so it isn't improvised under load):** the `consult_trace` view (a live `UNION ALL` over the source tables) and the O-2 full-text search over live message/draft tables are the right MVP-0 shape — 100% operator audit coverage over one pilot hospital's volume. They stop being the right shape once either (a) the view's query time visibly regresses in the Phase 4 dashboard queries (§11.3), or (b) a second real tenant is onboarded (Phase 6). The trigger for revisiting is explicit: **if either condition is hit, the next step is a materialized `consult_trace` refreshed incrementally (trigger-appended, not full-recompute) plus moving O-2 search to a dedicated text index (Postgres `tsvector` column with a GIN index at minimum; an external search service only if that's insufficient) — not a redesign of the trace's source-of-truth tables**, which stay append-only and unchanged. Whichever phase hits the trigger owns writing the migration; this is called out here so it's a planned phase deliverable, not a fire drill.

---

## 9. Multi-Tenancy Summary

- Tenant = `hospitals` row; resolved from subdomain, module resolved from path segment (§5.1, DEC-1 — delivery in MVP-1; MVP-0 uses an env-configured slug for the pilot); enforced by RLS (§8.3); themed by CSS variables + per-tenant, per-module manifest (§5.1).
- A patient with accounts at two hospitals has two `memberships`; data never crosses (T-4).
- Per-hospital config surface (all in `hospitals` row): `theme` (colors/logo/name), `ai_config` (model override, voice persona id, quotas). Nothing else is per-hospital in MVP.

---

## 10. Component Library & Design System (`packages/ui` + `packages/theme`)

### 10.1 Rules

1. **Single source**: every visual element used by more than one module lives in `packages/ui`. Module-local components are allowed only when genuinely module-specific (e.g., the doctor module's queue card); the moment a second module needs it, it moves to `packages/ui` in the same PR.
2. **Presentational only**: `ui` components take props and callbacks; they never fetch, never import `api`/`voice`, never read router or Supabase state.
3. **Tokens only**: no literal colors, font sizes, spacing, radii, or shadows in any component — CSS variables from `packages/theme` exclusively (`--vd-accent`, `--vd-surface`, `--vd-text`, `--vd-radius-*`, `--vd-space-*`, `--vd-font-*`). This is what makes hospital branding and dark mode zero-component-change.
4. **Accessibility floor**: every interactive component keyboard-operable, labeled, WCAG AA contrast in both themes; the consult screen fully usable with screen reader + text mode (the voice product must not be voice-*only*).
5. Each component ships with: types, a minimal usage doc-comment, and a Testing Library test for its states. No Storybook in MVP (revisit when a designer joins).
6. **Responsive by design (PRD UI-1, MVP-0)**: styles are written mobile-first; the only allowed breakpoints are the named `tablet`/`desktop` constants from `packages/theme` (DEC-15) — no ad-hoc pixel values in media queries. Page-level reflow belongs to layout components (`AppShell` and per-module layout shells), not to leaf components; a leaf component that must adapt to its own width uses a container query, not a viewport query. Touch targets ≥ 44px at every breakpoint. The doctor module's queue + review screen is the canonical case: stacked single-column on phone, queue-beside-review on tablet, three-pane (queue / transcript+draft / `PatientHistoryPanel`) on desktop — designed per breakpoint, not scaled.

### 10.2 Canonical inventory (check here before creating anything)

| Component | Purpose | Notes |
|---|---|---|
| `MiraConsole` | **the shared AI-voice-agent consultation interface** — hosts `MiraPresence` + transcript + configurable suggestion/action panel; minimize-to-orb ⇄ maximized | Contract in §10.4; the one voice-agent surface, configured per audience (PRD §5.0.1, MC-1–MC-7). Consumed by patient + doctor modules today, pharmacy/lab/admin later |
| `MiraPresence` | Mira's visual embodiment (orb → avatar) — rendered *inside* `MiraConsole` | Contract in §10.3; `OrbPresence` is the MVP implementation |
| `TranscriptView` | scrolling conversation, interim-transcript rendering | both modules |
| `ComposerBar` | text input + mic toggle + tap-to-finish | patient module; doctor module reuses for Ask-Mira |
| `RecommendationCard` | structured draft: items, why, advice, urgency | patient (read-only) + doctor module (editable variant) |
| `PrescriptionView` | approved prescription, print/share layout | patient + doctor module |
| `ConsultStatusBadge`, `UrgencyBadge`, `ConfidenceBadge`, `SafetyFlagList` | status chips | shared |
| `QueueCard` | consult summary card for the review queue | Doctor app (lives in ui for future admin reuse) |
| `PatientHistoryPanel` | profile + prior consults side panel | Doctor app |
| `EmergencyInterstitial` | red-flag full-screen guidance | patient |
| `AiDisclosureBadge` | persistent "AI doctor — reviewed by a human physician" | patient, always visible in consult |
| Primitives | `Button`, `Card`, `Sheet/Drawer`, `Dialog`, `TextField`, `Select`, `Toast`, `Skeleton`, `EmptyState`, `AppShell` (header/nav/safe-areas; owns page-level breakpoint reflow per §10.1 rule 6) | build once, first phase that needs them |

The prototype (`js/orb.js`, `index.html` keyframes) is the **visual reference** for the orb states and motion language — port, don't redesign.

### 10.3 `<MiraPresence>` contract (the avatar seam — do not weaken)

```ts
interface MiraPresenceProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  audioLevel?: number;              // 0–1, mic or playback envelope
  wordTimings?: WordTiming[];       // flows even though the orb ignores it
  visemes?: Viseme[];               // provider-dependent, may be empty
  tone?: MiraTone;                  // reserved emotion channel
}
```

`OrbPresence` (CSS/SVG, no canvas/WebGL) implements this in MVP. The future `AvatarPresence` implements the same props and is lazy-loaded; **no consumer may depend on implementation details of either**. Layout rule: consult screens are **call screens** — full-height presence area, transcript as overlay drawer (PRD §6.5).

### 10.4 `<MiraConsole>` — the shared, configurable consultation shell (PRD §5.0.1)

`MiraPresence` (§10.3) is *only* the embodiment. The whole reusable AI-voice-agent surface — presence + transcript + suggestion/action panel, in either the small floating orb or the full consultation view — is **`MiraConsole`**, and it is the interface PRD §5.0.1 (MC-1–MC-7) calls out as the product's single most-reused component. There is exactly **one** `MiraConsole`; every module (patient in patient mode, doctor in coordinator mode, and later pharmacy/lab/admin) mounts the same component and differs only by **configuration**, never by forking. It is the natural extension of the existing seams — it composes `MiraPresence` (§10.3) over the `packages/voice` turn-taking machine (§6.4) — so no new abstraction budget is spent; the reuse is why the presence and voice engines already live in shared packages.

```ts
type MiraAudience = 'patient' | 'doctor' | 'pharmacist' | 'lab' | 'admin'; // extensible

interface MiraConsoleProps {
  audience: MiraAudience;                 // MC-2 — who Mira is addressing
  personaMode: 'patient' | 'coordinator'; // MC-2 — maps to the server-side agent binding (§7, PRD A-9)
  session: MiraSession;                    // voice/turn-taking session (§6.4) — survives minimize/maximize (MC-4)
  presentation: 'orb' | 'expanded';        // MC-4 — controlled or uncontrolled; animates between the two
  channels?: { voice?: boolean; text?: boolean }; // MC-7 — co-equal, defaults per audience
  suggestions?: ReactNode;                 // MC-3 — audience-specific suggestion/action content (slot)
  disclosure?: ReactNode;                  // MC-2 — e.g. AiDisclosureBadge for the patient
  onMinimize?(): void; onMaximize?(): void;
}
```

- **MC-1/MC-2 — one component, configured per context.** Audience, persona/agent binding, enabled channels, branding (theme tokens per §10.1 rule 3 — nothing new), and disclosure copy are all props/config. `MiraConsole` stays presentational (§10.1 rule 2): it takes a `session` and callbacks, never fetches; context assembly and the persona↔agent mapping stay server-side (§7, PRD A-9).
- **MC-3 — configurable suggestion/action surface via a slot.** `MiraConsole` owns the layout and the voice↔panel synchronization; each module passes audience-specific content into the `suggestions` slot (patient: draft summary + safety flags via `RecommendationCard`/`SafetyFlagList`; doctor: presentation + editable draft + citations + approve/edit via the editable `RecommendationCard` + `PatientHistoryPanel`; pharmacist later: interaction warnings). Clinical/legal actions (signing) remain explicit authenticated UI actions raised by the host module — never voice-executed (mirrors D-9 / §7 "approval is UI-only").
- **MC-4 — minimize-to-orb ⇄ maximize, one session.** `presentation: 'orb' | 'expanded'` selects the small floating orb (presence + state at a glance) or the full call screen (§10.3 layout rule); tapping the orb maximizes, a control collapses it back. Both drive off the same `session`, so collapsing never tears down the conversation.
- **MC-5 — persistent floating overlay is an `AppShell` concern.** In orb form `MiraConsole` floats above the current module screen so Mira is always one tap away without navigation. It therefore mounts at the `AppShell` level (not per-route) so it survives in-module client-side navigation (AP-8); position is per-breakpoint (§10.1 rule 6), dismissable, and last position/state may persist. The orb's placeholder is part of the precached shell (§11.4).
- **MC-6/MC-7 — avatar-ready and channel-flexible for free.** Because `MiraConsole` renders `MiraPresence`, swapping orb → `AvatarPresence` (P11) touches nothing here. Text-only operation (mic denied/undesired) and screen-reader parity are the §10.1 rule 4 floor — every spoken turn already has a synchronized `TranscriptView` equivalent.

**Do not build the whole thing at once.** MVP-0 ships `MiraConsole` for the *patient* module (expanded call screen + orb minimize/overlay); the doctor module reuses it in coordinator mode in MVP-1 (Phase 5, where the deliverable already says "Doctor app reuses `packages/voice` + `MiraPresence`" — now via `MiraConsole`); pharmacy/lab/admin audiences are Phase 6+ config, not new components.

---

## 11. Performance, Cost & Observability

### 11.1 Performance budget (regressions are defects)

- LCP < 2.5 s on mid-range Android over 4G; initial JS ≤ **150 KB gzipped per module** (the per-module size budget CI enforces — DEC-19); Lighthouse PWA + Performance ≥ 90.
- Route-level code splitting; consult and records screens lazy-loaded; fonts self-hosted + preloaded (remove the prototype's Google Fonts CDN link); images `loading=lazy`, AVIF/WebP.
- CI runs `size-limit` on both app bundles; exceeding budget fails the build.

### 11.2 Cost guardrails (A-5)

Per-hospital daily consult quota + per-consult turn cap + per-call token cap, enforced in the orchestrator *before* provider calls. A `usage_events` lightweight log (tokens, STT seconds, TTS characters per consult) gives the operator per-hospital unit economics from day one.

### 11.3 Observability (MVP-sized)

- Structured logs in Edge Functions (JSON): request id, consult id, hospital id, agent id, latency segments (§6.1), token counts. **Never any PHI, transcript text, or patient identifiers beyond opaque ids.**
- Client: Sentry (or equivalent) with PII scrubbing on, plus Web Vitals reporting.
- One operator dashboard query set (SQL in `docs/ops.md`): consults/day per hospital, p50/p95 voice latency, approval-with-no-edit rate, quota consumption — the PRD §8 metrics must be *measurable* from launch, not retrofitted.
- **Consult Trace is the primary clinical observability surface** (§8.5): the operator audits 100 % of MVP-0 consults from it (RA-3), and RA-3's gate metrics (approval-with-minor-edits rate, median review time) come from `reviews` + `consult_events` — never from ad-hoc logging.

### 11.4 PWA architecture: instant loading, app-shell & preload strategy (AP-8)

§11.1's budget (LCP, JS size, Lighthouse score) measures whether the *first-ever* load is fast. This section is about the thing that actually reads as "app, not website": every load *after* the first, and every navigation inside the app, feeling instant because it was precomputed, precached, or preloaded before the user asked for it. Nothing here weakens the correctness rules already in place (consults are `NetworkOnly`, §5.5) — it only makes everything that's safe to cache aggressively cached.

**App shell (precached, not fetched-then-rendered):**
- The shell — `index.html`, the theme CSS variables, `AppShell` chrome, the `MiraPresence` placeholder — is Workbox-precached at build time (DEC-17, `injectManifest`) so a repeat visit paints the shell from the service worker cache with zero network round-trip, before Postgres/theme data even returns. This is the literal difference between "a page that loads" and "an app that opens."
- Critical CSS (tokens + shell layout) is inlined in `index.html`; everything else is chunked and loaded async so nothing non-essential blocks first paint.
- Manifest `display: "standalone"`, safe-area-inset CSS vars wired into `AppShell` from Phase 0 — no browser chrome, no URL bar, consistent with DEC-16's native-shell rules even before a native wrapper exists.

**Runtime caching strategy matrix (Workbox, per resource class — not one blanket policy):**

| Resource | Strategy | Why |
|---|---|---|
| Hashed build assets (JS/CSS/fonts) | `CacheFirst`, effectively immutable | Content-hashed filenames mean a cache hit is always correct — never re-fetch what can't have changed. |
| Navigation requests (route HTML/shell) | `NetworkFirst` short timeout (~1 s) → cache fallback, via Workbox `NavigationRoute` + the Navigation Preload API | Fresh when online and fast; instant from cache the moment the network is slow or absent, without the SW itself stalling the request. |
| Hospital theme/manifest (`tenant-manifest`, hospital row) | `StaleWhileRevalidate` | Correct branding paints instantly from cache (no flash of default theme), refreshes silently in the background. |
| Records list/detail, patient profile | `StaleWhileRevalidate` **and** persisted in the TanStack Query IndexedDB cache (DEC-18) | Two layers: SW cache makes the HTTP request instant; the persisted query cache means React never even shows a loading state on a warm launch. |
| Consult turn endpoints (`ai-consult`), doctor queue | `NetworkOnly` — never cached | Same rule as §5.5: correctness over speed where clinical state is live. |
| Consult/prescription images | `CacheFirst` with an expiration/max-entries plugin | Instant repeat view; bounded cache size so it doesn't grow unbounded. |

**Preload / prefetch (resource hints — starting the work before the tap, not after it):**
- `rel="preconnect"` to the Supabase project URL and the hospital's configured voice-provider WSS endpoint, emitted on shell load — the TLS/WS handshake is already warm by the time a patient taps "Talk to Dr. Mira," rather than starting cold inside the §6.1 latency budget.
- `rel="modulepreload"` for the consult route's JS chunk from the patient home/records screen, and for the review-screen chunk from the Doctor app's queue — the one screen a user is statistically about to open is speculatively fetched while they're still looking at the current one, so the tap itself triggers a render, not a fetch-then-render.
- Fonts self-hosted and `rel="preload"` (already decided, §11.1) — no FOIT/FOUT.
- **Voice-token pre-warm**: `voice-token` is called optimistically the moment the consult screen mounts (before the patient taps "Talk"), so the STT/TTS session is already authorized when they start speaking — this shrinks perceived latency without changing anything the §6.1 budget measures.

**Instant repeat launches (the single biggest lever for "app-like"):**
- The DEC-18 persisted query cache means a returning user sees their real theme, profile, and records on screen immediately on cold app open, with a background refetch reconciling — never a blank shell + spinner on every launch, only on the very first one.
- SW updates ship via `skipWaiting` + `clientsClaim` gated behind an explicit "update ready" toast/banner — the shell stays precache-fresh without ever silently reloading a patient mid-voice-turn.

**Interaction-level app-likeness (small, compounding details):**
- No tap-delay: `touch-action` set correctly on interactive primitives from Phase 0 (§10.2) — no reliance on a synthetic 300 ms click delay.
- `Skeleton` (already a listed primitive, §10.2), never a bare spinner, on anything in the instant-paint path — perceived performance is part of this budget, not just measured performance.
- View Transitions API (progressive enhancement, feature-detected — never blocked on) for in-app navigation (queue → review, home → consult) so moving between screens reads as a transition, not a page load; unsupported browsers fall back to an instant swap, not a missing feature.
- **Back/forward-cache (bfcache) eligibility is a CI-checked budget item** alongside LCP/JS-size (§11.1): no `unload` listeners, no blocking `beforeunload`, no `Cache-Control: no-store` on navigable routes. This is what makes back-navigation between queue/consult/records instant rather than a re-fetch — and back-navigation is the doctor's and patient's most common action in this product.

This section is binding from **Phase 0** (shell precache + resource-hint skeleton exist from day one, per the Phase 0 deliverables in §12) and is explicitly checked in **Phase 4**'s hardening pass (bfcache, standalone display, update-toast behavior, DEC-18 persistence) before pilot launch.

---

## 12. Implementation Phases

Phases map onto the PRD's release ladder (PRD §2): **Phases 0–4 = MVP-0** (validate the core loop with one pilot hospital), **Phases 5–6 = MVP-1** (widen once the loop is proven). Rules: phases ship in order; a phase is done only when its acceptance checks pass in CI/staging; "do not build yet" lists are binding. Each phase ends with a tagged, deployable state.

> **Gate G-1 (RA-1, blocking):** the Doctor app portion of Phase 2 does not start until at least **2 named doctors at the pilot hospital have reviewed mock AI drafts and agreed in writing to sign real ones** (PRD §2A). This is a product gate, not an engineering task — engineering proceeds through Phase 0–1 and the patient side of Phase 2 while it's pursued. If RA-1 fails, stop and re-plan; do not build the Doctor app on hope.

### — MVP-0 (single pilot hospital, tenant seeded directly; multi-tenant *schema* from day one) —

### Phase 0 — Foundation (goal: an empty but real product skeleton)
**Deliverables:** monorepo per §4; `packages/config` toolchain; `packages/theme` tokens (light/dark) incl. the named `tablet`/`desktop` breakpoint constants (DEC-15); `packages/platform` skeleton (§1.3 seam 5 — web implementations only); `packages/core` with consult state machine, contracts (§7.3) and i18n scaffold (tenant *parsing* code exists in `core` but subdomain wiring waits for Phase 6); CI (typecheck/lint/test/build/size-limit, plus the DEC-19 import-boundary and per-module size-budget checks); the single PWA deploys to Cloudflare Pages (one project, default project domain) with both `/patient` and `/doctor` module routes showing a themed shell branded from seeded hospital config; **PWA shell foundation (§11.4, AP-8)**: `injectManifest` Workbox setup (DEC-17) precaching the app shell, manifest `display: standalone` + safe-area insets wired into `AppShell`, and the resource-hint skeleton (`preconnect` to Supabase, self-hosted preloaded fonts) — the caching-strategy matrix itself fills in as each resource class is introduced in later phases.
**Accept:** `npm i && npm run build` green; both module routes live and branded from seed data; CI enforces budgets and the import-boundary rule; a second (offline, cache-only) load of either module still paints the branded shell from the SW precache.
**Do not build yet:** any Supabase table beyond `hospitals`, any AI call, any voice code, subdomain/path routing plumbing.

### Phase 1 — Data platform & auth (goal: tenancy is real and provably isolated)
**Deliverables:** full schema + RLS (§8, incl. `consult_events`, the `consult_trace` view, the state-machine trigger, and the one-open-consult index) as migrations; seed script (2 hospitals — pilot + a synthetic second tenant to keep isolation honest — 2 doctors each, sample patients); Supabase Auth wired (Google for patient app, email/pw for Doctor app); profile wizard with 18+ DOB enforcement (§5.6); generated DB types in `packages/api` + base query hooks; RLS negative-test suite in CI.
**Accept:** the four cross-tenant denial tests pass; a patient can sign in, complete profile, see an empty records list; a doctor sees an empty queue for *their* hospital only; an under-18 DOB is rejected at profile completion.
**Do not build yet:** AI, voice, review actions.

### Phase 2 — Text consult, end to end (goal: the full loop works before voice exists)
**Deliverables:** `ai-consult` Edge Function with orchestrator, agent registry (**Doctor Agent alone**, §7.2), context assembly, safety layers 1–3, quotas; patient consult UI (text mode: `TranscriptView`, `ComposerBar`, `RecommendationCard`, `EmergencyInterstitial`, `AiDisclosureBadge`); consult lifecycle to `pending_review`; lifecycle timers via `pg_cron` (§5.6: SLA warn/escalate, 24 h expiry, 30 min abandonment) with rejection/expiry patient messaging; **[gated by G-1]** Doctor app queue (Realtime) + review screen + approve/edit/reject RPCs + audit `reviews`; patient records list + `PrescriptionView`; operator trace access (the `consult_trace` view + `docs/ops.md` queries + `export_consult_trace` RPC).
**Accept:** scripted E2E: patient completes a text consult → doctor edits + approves → patient sees the signed prescription — **and the consult's trace timeline contains every step of that journey** (turns, draft, queued, doctor_opened, decision + diff, notification, closure); allergy hard-rule blocks a conflicting draft in post-validation; red-flag input produces urgent flag + interstitial; starting a second consult resumes the open one; timers fire in a clock-mocked test; all actions audited; the Doctor app's queue + review screen reflows per §10.1 rule 6 (single-column at phone width, multi-pane at desktop width — verified at both viewports in the E2E).
**Do not build yet:** any STT/TTS, Doctor app voice, images, push, Receptionist agent.

### Phase 3 — Patient voice (goal: the product's core experience at target latency)
**Deliverables:** `packages/voice` (state machine, sentence splitter, Deepgram + Chirp 3 HD adapters, webspeech dev adapter); `voice-token` function; `OrbPresence` ported from prototype; call-screen layout; barge-in; mixed voice/text turns; latency instrumentation (§6.1); spoken AI disclosure at consult start.
**Accept:** hands-free consult end-to-end on a mid-range Android; p50 end-of-speech → first audio < 1.5 s, p95 < 3 s on staging; mic-denied path falls back to full text consult; timestamps observable flowing to `MiraPresence` props.
**Do not build yet:** Doctor app voice, avatar work of any kind.

### Phase 4 — MVP-0 hardening & pilot launch (goal: live with the design-partner hospital)
**Deliverables:** quotas + `usage_events` + operator dashboard queries (PRD §8 and RA-2/RA-3 gate metrics measurable); Sentry + Web Vitals; security pass (headers/CSP, dependency audit, RLS re-review); accessibility pass; responsive pass — both modules exercised at phone/tablet/desktop widths against §10.1 rule 6 (UI-1); a DEC-16 readiness check (no raw capability APIs outside `packages/platform`/`voice`, no browser-chrome-dependent flows); **PWA hardening pass (§11.4)**: full caching-strategy matrix in place and verified per resource class, DEC-18 query-cache persistence live for theme/profile/records, preload/prefetch hints (route modulepreload, voice-token pre-warm) measured to actually shave latency, SW update-toast flow tested (no silent mid-consult reload), bfcache-eligibility check added to CI; PWA install polish + offline records; load sanity test (50 concurrent consults); pilot runbook (rota/SLA config for the hospital, incident + breach-notification runbooks).
**Accept:** Lighthouse ≥ 90 for both modules; RA-2 (completion/voice rates) and RA-3 (approval-with-minor-edits, median review time) computable from the dashboard on day one of the pilot; operator can audit any consult end-to-end from its trace; a warm repeat launch of either module paints real (not skeleton) theme/profile/records content before any network response returns; both modules pass a bfcache eligibility check in CI.
**Do not build yet:** anything in MVP-1 below.

### — MVP-1 (widen once the loop is proven; entry criteria = RA-2/RA-3 gates holding in the pilot, PRD §2A) —

### Phase 5 — Doctor app coordinator voice (goal: Mira presents; the doctor converses)
**Deliverables:** coordinator mode in the orchestrator (SBAR presentation, grounded Q&A with citations per D-8, conversational edits per D-9 — `action:'edit'` updates the on-screen draft only); Doctor app reuses `packages/voice` + `MiraConsole` (coordinator-mode config, §10.4); per-doctor mute/skip preference (persisted); `review_messages` audit (in the trace); `mira_feedback` capture UI.
**Accept:** doctor opens a case, hears the presentation, asks two history questions answered with on-screen citations, dictates an edit, sees the draft change, signs via UI; voice cannot trigger approval (test exists); presentation skippable; the review conversation appears in the consult trace.
**Do not build yet:** specialist/pharmacy agents, outbound calls.

### Phase 6 — Multi-tenant delivery & MVP-1 completion (goal: onboarding a second hospital is config-only)
**Deliverables:** subdomain + path tenant/module resolution wired (T-1, DEC-1) + wildcard DNS and the Cloudflare SPA history-fallback/path-routing rule for the one Pages project (DEC-12, DEC-19); `tenant-manifest` per-tenant, per-module PWA manifests + branded installs; operator onboarding runbook (< 1 h per hospital, executed once end-to-end for a fresh tenant); patient photo sharing (per-hospital bucket, Gemini vision findings into the assessment, `consult_media`, in the trace); web push on approval; **Receptionist agent split** (own registry entry per §7.2).
**Accept:** a brand-new tenant is live on its own subdomain (both `/patient` and `/doctor` paths) with zero code changes; photo consult E2E passes; push received on approval; agent split verified as config-only (no orchestrator refactor in the diff).

### 12.7 Phase dependency graph & parallel execution

§12's phases read as a numbered list, which reads as strictly sequential — that's true *across* phases (each phase's acceptance checks gate the next), but it hides real parallelism *within* and *across* phases that matters once more than one engineer or agent is executing this plan at once. This section makes both explicit.

**Hard sequential dependencies (cannot start before the prior phase's acceptance checks pass):**
```
Phase 0 → Phase 1 → Phase 2 (text loop) → Phase 3 (voice) → Phase 4 (hardening/launch)
Phase 4 → Phase 5 (Doctor app voice) → Phase 6 (multi-tenant delivery)
```
These are hard because each depends on a runtime contract the prior phase produces (Phase 1's schema/RLS before any data-touching feature; Phase 2's working text consult loop before voice is layered on top of the same orchestrator; Phase 4's live pilot before widening to a second tenant).

**Already-explicit parallel split (Phase 2):** the patient-side consult loop and the Doctor app are independently buildable; only the Doctor app build is gated behind **G-1**. A team can build/ship the patient-side portion of Phase 2 while G-1 is still being pursued — this was already correct in v1.2, just restated here as the pattern for the rest of this section.

**Sub-phase work packages (same phase, splittable across parallel workstreams, coordinate only at the named seam):**
- **Phase 1** is one phase but four independent packages behind one seam (the migration sequence number): (a) schema + RLS policies, (b) the state-machine trigger + `consult_events` + `consult_trace` view, (c) Supabase Auth wiring + profile wizard, (d) seed script + RLS negative-test suite. Running these in parallel is safe *only* if migration numbering is coordinated (one owner rebases/renumbers before merge) — the risk isn't the work, it's two agents claiming the same migration number.
- **Phase 4** similarly splits into independently ownable packages that only share the acceptance checklist, not code: observability (usage_events, dashboard, Sentry), security/accessibility pass, responsive pass (§10.1 rule 6 verification), PWA/offline polish, pilot runbook docs.
- **Phase 6** splits into: subdomain/path-routing + tenant-manifest delivery, photo sharing (`consult_media` + vision), web push, and the Receptionist agent split — these touch disjoint parts of the system (routing/hosting, storage, notifications, agent registry) and can run fully in parallel once Phase 5 is accepted.

**Soft/opportunistic parallelism (may start early, at risk, before its formal gate):** groundwork for a later phase that doesn't touch runtime behavior can start during the prior phase without violating "do not build yet" — e.g. drafting the `VoiceProvider` adapter interface and its tests during Phase 2 (before Phase 3 formally starts) is fine because it's inert until wired into the orchestrator; actually calling Deepgram/Chirp from a live consult before Phase 3's acceptance checks is not. The distinguishing rule: **inert scaffolding may start early; anything reachable from a live user flow may not.**

**Post-MVP phase ladder (direction, not commitment) — each phase below needs an explicit entry gate before it starts, not just a place in the list:**

| Phase | Scope | Entry gate (minimum) |
|---|---|---|
| P7 | Pharmacy + Lab agents, admin UI | Phase 6 accepted; at least one hospital has requested lab-report or pharmacy-check functionality (demand signal, not just roadmap order) |
| P8 | Specialist agents + Supervisor + feedback loop | `LlmProvider` and agent-registry fan-out/fan-in semantics (concurrent specialist calls, partial timeout/conflict handling — flagged as an open design question, not yet solved by today's single-call orchestrator) are designed *before* this phase starts, not during it |
| P9 | i18n locales (Kannada/Telugu/Hindi voice+text) | A non-English-speaking pilot hospital or explicit demand signal exists; i18n catalog scaffolding (already in place since Phase 0) has zero hardcoded-string violations in CI |
| P10 | Communication Manager, outbound Mira call, doctor-patient video | P7/P8 stable in production for at least one full pilot cycle (this phase adds the largest new safety/consent surface — outbound calls — and should not land on an unproven agent base) |
| P11 | `AvatarPresence` | `<MiraPresence>` contract (§10.3) has had zero breaking changes requested by any consumer across all prior phases — proof the seam actually held |
| P12 | Native app containers (Capacitor, DEC-16) | The DEC-16 readiness check (§ Phase 4) has passed in every phase since Phase 4 with zero regressions — i.e. this is packaging, confirmed cheap, not a rewrite in disguise |

If an entry gate isn't met when a phase's turn comes up, the answer is to fix the gate or explicitly re-scope — not to start building anyway because it's next on the list.

---

## 13. Best Coding Practices (binding for all agents)

### 13.1 General
- TypeScript `strict`; **no `any`** (use `unknown` + narrowing); no `@ts-ignore` without a linked issue.
- **Validate at every boundary** with the shared Zod schemas: client→EdgeFn input, LLM output, EdgeFn→client payloads, form input. Inside a validated boundary, trust the types.
- Small modules, one responsibility; functions that fit on a screen; prefer pure functions in `core`.
- Errors: never swallow. User-visible failures get a friendly i18n message + retry affordance; internals get a structured log with request id. Voice errors degrade to text, never dead-end.
- Naming: `camelCase` TS, `snake_case` SQL, `kebab-case` files, `PascalCase` components. Domain terms from the PRD glossary only (`consult`, not `session`/`case` mixed; `patient` is canonical, never `customer` in code).
- Comments explain constraints and *why*, not what. No commented-out code in main.

### 13.2 React
- Function components + hooks only. Server state in TanStack Query (keys defined centrally in `packages/api` — never inline strings); UI state local; no global state library.
- Data fetching in `packages/api` hooks; components stay presentational (§10.1). Lazy-load routes. No `useEffect` for derivable state.
- Layout comes from CSS (named breakpoints/container queries per §10.1 rule 6) — never from user-agent or screen-size sniffing in JS. Browser/native capabilities only via `packages/platform` (and `packages/voice` for mic); no raw `Notification`/`navigator.share`/storage-API calls in app or component code (DEC-16).

### 13.3 SQL / Supabase
- Schema changes only via migrations; every table RLS-enabled default-deny in the same migration that creates it; every privileged write is an RPC with an explicit grant, not a broad policy.
- Never use the service role key outside Edge Functions. Never interpolate SQL.

### 13.4 AI / prompts
- Prompts are versioned code (`_shared/agents/prompts/`), reviewed like code, with golden-transcript tests: a fixture suite of consult scenarios (common cases, allergy conflict, red flags, prompt-injection attempts from the patient) runs against schema-validity and safety assertions on every prompt change. Model/params referenced from config only — never hardcoded at call sites, and always through `LlmProvider` (§1.3 seam 6).
- Treat all user input as untrusted prompt content: patient text is delimited and never concatenated into system-level instructions.
- **Prompt rollout is a deploy, not a git merge.** A merged prompt change is not live until it is pointed at from `hospitals.ai_config.prompt_version` (or the platform default). "Reviewed like code" governs whether a prompt change is *correct*; it says nothing about whether it is *safe to turn on everywhere at once* — for a system where the prompt is the clinical behavior, those are different questions and this document treats them as different steps:
  1. **Canary by tenant, not by traffic %**: land the new prompt version behind an explicit version id; flip exactly one hospital's `ai_config.prompt_version` to it (the pilot hospital in MVP-0; a low-volume tenant once multi-tenant); watch RA-3's signals (approval-with-minor-edits rate, safety flags, review time) for that hospital specifically before flipping the platform default.
  2. **Rollback is a config write, not a redeploy**: the previous prompt version stays addressable (versions are never deleted, only superseded as the default) so an incident response is "point `ai_config.prompt_version` back," not "revert and redeploy the Edge Function."
  3. **A prompt-version bump to a clinically material prompt (safety rules, dosing, red-flag list) requires the golden-transcript suite to pass *and* is logged as a `consult_events`-adjacent `prompt_change` audit row (agent id, old/new version, who approved) — this is deferred infrastructure, not needed before Phase 2, but the `ai_config.prompt_version` field and the version-never-deleted rule should exist from Phase 2 onward so this isn't retrofitted under incident pressure.
- This same per-hospital `ai_config` override is the general canary/rollout primitive for any future-phase feature gated by tenant (e.g. enabling the Receptionist split or a new specialist agent for one hospital before defaulting it platform-wide) — see §12.7.

### 13.5 Process
- Trunk-based; small PRs (one concern); PR template asks: phase compliance? new dependency justified? contract change reflected in ARCHITECTURE.md? tests?
- Tests: unit for `core`/`voice` logic (state machines, sentence splitter, contracts), component tests for `ui` states, one Playwright smoke per primary use case (UC-1/2/3), RLS negative suite, prompt golden suite. Target: the Phase-2 E2E stays green forever.
- Architectural decisions that deviate from or extend this document → short ADR in `docs/adr/` + update the relevant section here in the same PR. This document must never drift from the code.

---

## 14. Glossary (canonical terms — use these exact words in code and docs)

| Term | Meaning |
|---|---|
| **consult** | One patient↔Mira conversation and its lifecycle (§8.4) |
| **draft** | Mira's recommendation before doctor approval (`ai_drafts`) |
| **prescription** | Doctor-approved, immutable record (may be of type advice/investigation) |
| **patient mode / coordinator mode** | Mira's two personas (PRD A-9) |
| **presence** | Mira's visual embodiment (orb → avatar) behind `<MiraPresence>` |
| **turn** | One user input + one Mira response |
| **trace** | The Consult Trace: one chronological, exportable timeline of everything that happened in a consult (§8.5) |
| **tenant / hospital** | Interchangeable; `hospital` in code |
| **operator** | The platform owner (you) |
| **MVP-0 / MVP-1** | The two MVP increments (PRD §2): core loop with one pilot hospital → widen (Doctor app voice, tenancy delivery, photos, push) |
