# Code review — AI-Doctor

A React 19 PWA plus a Supabase backend in which an LLM takes a patient history and drafts a clinical plan that only a doctor-authenticated Postgres function can turn into a prescription.

Read: all three Edge Functions and `supabase/functions/_shared/*`, all 12 migrations at least in the parts that carry policy or trigger logic, `apps/web/src/lib/api/*`, `store/SupabaseClinic.tsx`, `shell/auth.tsx`, `modules/patient/useConsult.ts`, `modules/doctor/useReview.ts`, and the manifests. Not read: the CSS modules, most of `modules/*/components/*`, `supabase/seed.sql`, the pgTAP suites in full, and `docs/` beyond skimming `QA-FINDINGS.md` and `TODO.md`.

## Architecture

Three layers with one hard boundary.

**Postgres is the authorization layer.** There is genuinely no permission code in the app. `prescriptions.review_id` is `NOT NULL UNIQUE` (`supabase/migrations/20260101000005_the_gate.sql:41`), `prescriptions_require_approving_review()` (same file:86) re-checks that the review is approving, by the same doctor, on the same consult, and that `reviews.draft_hash` still equals `ai_drafts.content_hash`; and `20260101000012_grants.sql:57` revokes INSERT on `prescriptions`/`prescription_items`/`reviews` from `anon`, `authenticated` **and** `service_role`, so the AI path physically cannot write one. State moves through the `consult_transitions` allowlist table plus `enforce_consult_transition()` (`..._consults_state_machine.sql:96`), which refuses any transition whose actor was not named via `set_config('vd.actor')`. This is the strongest part of the repo and it is worth keeping exactly as it is.

**The Edge Functions are orchestration.** `supabase/functions/_shared/agent.ts` rebuilds the whole consult state from Postgres on every turn (`loadState`, :99) so nothing authoritative lives in a long-lived object or the browser. `runPatientTurn` (:307) runs the deterministic red-flag sweep *before* any model call, lets `questionnaire.ts` decide what the turn is for, lets the model only rank and phrase inside those bounds, then re-validates the output with `guards.ts`. The ordering is right and the comments explaining why are accurate.

**The frontend has two interchangeable halves.** `store/LocalClinic.tsx` (seeds + `localStorage`) and `store/SupabaseClinic.tsx` (live, 416 lines) implement the same `Clinic` surface from `store/types.ts`; `ClinicProvider.tsx` picks one on `hasSupabase()`. Screens cannot tell them apart, which is a clean seam.

Where it will hurt:

- **There are two clinical agents in this codebase, and only one of them is safe.** The server agent is gated, guarded and traced. `apps/web/src/lib/api/ai.ts` is a second one that lives in the browser: `TOPICS` (:40–86) hard-codes real drugs at real doses — Paracetamol 500 mg, Ibuprofen 400 mg, Omeprazole 20 mg, Cetirizine 10 mg — and `apps/web/src/modules/patient/useConsult.ts:37` carries a full independent clinical system prompt with its own emergency list. None of `guards.ts`, `redflags.ts` or `check_drug_safety` touches that path. It is reachable whenever `VITE_SUPABASE_URL` is unset at build time, which is a build-config accident away.
- **`runPatientTurn` is 150 lines doing seven jobs**: protocol binding, red-flag sweep, gate decision, model call, regeneration retry, slot merge and persistence (`agent.ts:307-459`). The retry block (:398-419) duplicates the whole compose call rather than looping. Every new gate rule lands in the middle of this function.
- **`ai-consult/index.ts` decides the conclude step from a stale snapshot.** `loadState` runs at :55, the turn is persisted inside `runPatientTurn`, then `concludeStep(state, CAPS)` at :85 re-reads that same pre-turn `state` — so `patientTurns` and the newly filled slots are a turn behind and the read-back/conclude gate fires late.
- **The voice tool machinery is unreachable.** `_shared/tools.ts` (323 lines: registry, allowlist, `assertAllowlistMatches`) has exactly one caller in the whole repo — `agent.ts:527`, for `check_drug_safety`. Nothing dispatches a Live `functionCall`, and the client never opens the WebSocket: `useConsult.ts:169` mints a token and throws the result away. `record_slot`, `raise_red_flag` and `end_consult` have no execution path from an audio session.
- **The safety prompt exists twice**, as `PERSONA`/`SAFETY` in `agent.ts:41-56` and as `PATIENT_SYSTEM` in `voice-token/gemini-live.ts:127`. They will drift.

## Code quality

Types are strict (`tsconfig.base.json` sets `strict: true`) and mostly honest; the SQL is the best-documented part of the repo. Below that:

- **Every RPC call in the escalation path ignores its error.** `agent.ts:242`, `:256`, `:263` and `:271` all destructure `{ data }` only. If `raise_red_flag` or `ai_escalate_to_human` fails, the patient is still told the emergency script and the function returns `status: 'needs_human'` — while the consult is still `active` and no doctor has been notified. This is the single most consequential defect in the file.
- **A database write failure is reported as a model outage.** `agent.ts:448` throws when `ai_record_turn` errors; `ai-consult/index.ts:62` catches everything from `runPatientTurn` and returns `503 model_unavailable` with the message "your consult is saved". It is not saved.
- **`logInvocation` (`agent.ts:196`) discards its result**, so spend accounting silently stops on error.
- **`errorResponse` leaks internals**: `_shared/http.ts:29` puts `e.message` from any unhandled exception into a 500 response body.
- **Dead SQL.** `check_drug_safety`, `ai_record_turn` and `ai_submit_draft` are defined in `20260101000007_rpc.sql` / `20260101000010_ai_path.sql` and then redefined wholesale in `20260101000011_agent_loop.sql:319`, `:490`, `:602`. The earlier bodies are unreachable but still read as current.
- **Test coverage is one-sided and unrun.** Three pgTAP suites (35 assertions) cover the gate, transitions and RLS isolation — the right three things. There is not a single test under `apps/` or for `supabase/functions/`, and `supabase/README.md` states that `supabase db reset` and `supabase test db` have never been executed against a live database, so even the SQL is uncompiled. `playwright` is a root devDependency with no test file using it.
- **34 `any` / `as any` sites**, concentrated where the model output is parsed: `useConsult.ts:60` and `useReview.ts:11` both return `any` from a hand-rolled `parseAi` that strips code fences and slices between the first `{` and last `}`.
- **Secrets/config.** `apps/web/.env.production` is committed and `.gitignore` covers `.env` and `.env.local` but not `.env.production`. It carries a real hosted project URL, its anon key (public by design) and `VITE_DEMO_PASSWORD=1234` — which, with `enable_signup = true` in `supabase/config.toml`, means the seeded doctor account of the live shared project is publicly usable. No provider key appears anywhere in the bundle; that part of the discipline holds.
- **`TODO.md` is stale.** "P1 SECURITY: Anthropic/Gemini/Google keys live in localStorage" is still unticked, but `lib/api/ai.ts` has no key path any more.
- Console noise is `console.warn` only and consistently prefixed `[vd]` (`SupabaseClinic.tsx:128` etc.). Fine.

## Risks

**Neither `ai-review` nor `voice-token` coordinator mode checks that the caller is a doctor.** Both read the consult "as the caller" and treat a successful RLS read as authorization — but `consults_patient_read` (`..._consults_state_machine.sql:237`) lets a patient read their own consult in *every* status. So a patient whose consult is `pending_review` can:

- `POST /functions/v1/voice-token` with `{"mode":"coordinator"}` and be minted a Gemini Live session bound to `COORDINATOR_SYSTEM` and `COORDINATOR_TOOLS` (`voice-token/index.ts:64` is the only status check; there is no role check anywhere in the file). That is the clinician-facing agent, discussing an unapproved draft, handed to the patient — the exact disclosure the approval gate exists to prevent.
- `POST /functions/v1/ai-review` and drive the coordinator model over their own transcript (`ai-review/index.ts:26-29`), with no `check_quota` call anywhere in that function, and write rows into `review_messages` attributed to their own uid via `ai_record_review_message`. `review_messages_doctor_read` (`..._drafts_safety.sql:192`) scopes reads to `doctor_id = auth.uid()`, so those rows do not reach the reviewing doctor's thread — the containment is accidental but real.

**`ai_record_review_message` validates nothing about who it is writing for.** It is `SECURITY DEFINER`, takes `p_doctor_id` as a parameter, and never checks membership, role or consult status (`20260101000010_ai_path.sql:178`). It is revoked from `authenticated`, so the only exposure is via the Edge Function above — but it is the primitive that makes that exposure possible.

**The uncited-claim gate is a length check.** Same function, :187: `jsonb_array_length(citations) = 0`. A model that returns one fabricated `message_id` passes. The docs describe this as the guarantee that every coordinator claim is quoted from the transcript; it is not.

**The daily audio quota can be silently bypassed.** `voice-token/index.ts:84` sums `audio_seconds` by fetching every `agent_invocations` row for the hospital for the day through PostgREST, and `supabase/config.toml` sets `max_rows = 1000`. Past 1000 rows the sum stops growing and the cap never fires. This must be a server-side aggregate, not a client-side reduce.

**Pre-warming burns the budget it is meant to protect.** `useConsult.ts:169` mints a voice token on consult start and discards it; each mint writes an `agent_invocations` row charging `sessionMinutes * 60` seconds (`voice-token/index.ts:177`) for a session that is never opened, because no client code opens one.

**Self-asserted identity attributes.** `handle_new_user` (`..._identity_tenancy.sql:133`) takes `profiles.kind` from `raw_user_meta_data`, and `20260101000012_grants.sql:44` plus `profiles_update_self` let a user update their own `profiles` row, `kind` included. Nothing authorizes on `kind` today except the `doctor_card` view, and `memberships` is correctly not client-writable — so this is not currently exploitable, but it is one policy away from being so. Separately, `shell/auth.tsx:47` derives the UI role from `user_metadata.role`, which the user can set via `auth.updateUser`; that grants the doctor UI, not doctor data.

**Anyone can sign up into the shared demo database.** `enable_signup = true`, no email confirmation, and `authenticated` holds INSERT on `consult_messages`, `lab_results`, `consult_media`, `mira_feedback` and `patient_details`. Row policies scope each to the caller, so this is quota and storage abuse rather than a data breach — but the README advertises the DB as shared by everyone who opens the link.

**Clinical content that nobody signed off.** `_shared/redflags.ts:9` says so itself: the phrase list is a seed with no clinician owner. The `drug_class_map` is seeded with penicillin and one cephalosporin caution. Both are load-bearing for the safety story.

**Known unfixed data-mixing bug in demo mode.** `docs/QA-FINDINGS.md` QA-01 — approving any doctor-queue case files that patient's plan into the signed-in demo patient's own records — is still live at `apps/web/src/store/LocalClinic.tsx:132`, which sets `user: true` on the approving doctor's case.

CORS is `Access-Control-Allow-Origin: *` on all three functions (`_shared/http.ts:7`); with bearer-token auth and no cookies that is low severity, but it means any origin can spend the deployment's model budget with a token it has obtained.

## Action items

| Priority | Item | File | Why |
|---|---|---|---|
| P0 | Require `has_hospital_role(consult.hospital_id, ['doctor','admin'])` before minting a coordinator session | `supabase/functions/voice-token/index.ts:64` | A patient can currently mint the clinician-facing Live session on their own pending-review consult |
| P0 | Require the same doctor role check before any coordinator turn | `supabase/functions/ai-review/index.ts:26` | Patients can drive the coordinator agent and write `review_messages` as themselves |
| P0 | Check the error on every RPC in `escalate()` and fail loudly if the escalation did not persist | `supabase/functions/_shared/agent.ts:242` | A failed red-flag escalation currently returns success; no doctor is notified and the consult stays `active` |
| P0 | Stop shipping `VITE_DEMO_PASSWORD` and add `.env.production` to `.gitignore` | `apps/web/.env.production` | A committed password plus open signup makes the live demo's seeded doctor account publicly usable |
| P1 | Replace the client-side audio-budget sum with a Postgres aggregate RPC | `supabase/functions/voice-token/index.ts:84` | `max_rows = 1000` truncates the page, so the daily cap silently stops firing |
| P1 | Validate `p_doctor_id` against membership and role inside the definer function | `supabase/migrations/20260101000010_ai_path.sql:178` | The primitive trusts its caller entirely; only a revoke stands between it and any client |
| P1 | Verify citations reference real `consult_messages.id` rows for this consult | `supabase/migrations/20260101000010_ai_path.sql:187` | The uncited-claim gate is a `jsonb_array_length` check and passes a fabricated id |
| P1 | Distinguish a persistence failure from a model outage instead of returning `model_unavailable` | `supabase/functions/ai-consult/index.ts:62` | The patient is told "your consult is saved" precisely when the save failed |
| P1 | Add `check_quota` to the coordinator path | `supabase/functions/ai-review/index.ts:49` | The only unmetered model call in the system |
| P1 | Re-read state (or return the post-turn state from `runPatientTurn`) before deciding the conclude step | `supabase/functions/ai-consult/index.ts:85` | The read-back and draft gates run a turn behind the persisted transcript |
| P1 | Delete the browser clinical engine and its system prompt, or gate it behind an explicit dev-only flag | `apps/web/src/lib/api/ai.ts:40` | Hard-coded real drugs at real doses reach a patient with none of the server guards applied |
| P1 | Either implement the Live tool dispatcher or remove the unreachable registry | `supabase/functions/_shared/tools.ts:298` | 300 lines of safety-critical code with one caller; a voice session's `raise_red_flag` goes nowhere |
| P1 | Stop pre-warming the voice token, or log `audio_seconds = 0` until a session is actually opened | `apps/web/src/modules/patient/useConsult.ts:169` | Every consult start charges a full session against the audio budget for a session nobody opens |
| P1 | Fix the demo-store cross-patient plan leak (QA-01) | `apps/web/src/store/LocalClinic.tsx:132` | Approving any queue case files that plan into the signed-in demo patient's own records |
| P1 | Run `supabase db reset` and `supabase test db` once and record the result | `supabase/README.md` | The entire authorization layer is currently uncompiled and untested SQL |
| P2 | Remove `profiles.kind` from `raw_user_meta_data` and from the client UPDATE grant | `supabase/migrations/20260101000002_identity_tenancy.sql:133` | A self-asserted clinician flag that is one policy away from mattering |
| P2 | Derive the UI role from `memberships`, not `user_metadata` | `apps/web/src/shell/auth.tsx:47` | The role the app routes on is browser-writable |
| P2 | Drop the superseded `check_drug_safety` / `ai_record_turn` / `ai_submit_draft` bodies | `supabase/migrations/20260101000007_rpc.sql:30` | Three functions defined twice; the dead copies read as current |
| P2 | Extract the model call + regeneration retry out of `runPatientTurn` | `supabase/functions/_shared/agent.ts:398` | The compose call is written twice inside one 150-line function |
| P2 | Single-source the safety prompt shared by the text and voice personas | `supabase/functions/_shared/agent.ts:49` | Two copies of the clinical safety rules will drift |
| P2 | Return a generic message for unhandled exceptions | `supabase/functions/_shared/http.ts:29` | Internal error text is currently returned to the client |
| P2 | Reconcile `TODO.md` with the code | `TODO.md:14` | An open P1 security item that the code already fixed |
