# Virtual Doctor — backend

The Supabase implementation of `docs/DATA-MODEL.md`. Postgres is the authorization
layer: the §3.6 matrix is `CREATE POLICY`, the §3.4 gate is a constraint plus a
trigger, and the §3.2 state machine is an allowlist table plus a trigger. There is no
application-layer permission code anywhere in this folder, because there is nowhere
for one to sit.

Everything here is a version-controlled artifact a human applies deliberately. No
remote project is created, configured, or written to by anything in this repo.

```
src/backend/
  migrations/   0001..0010, forward-only, each shipping its own RLS
  functions/    Deno Edge Functions: ai-consult, ai-review, voice-token, _shared/
  tests/        pgTAP suites (run by `supabase test db`)
  seed.sql      the demo data the frontend shows today
```

`supabase/` at the repo root holds `config.toml` and three symlinks
(`migrations`, `functions`, `tests`) pointing into this folder, because the CLI only
looks in `supabase/`. The seed is referenced by path from `config.toml`.

## Run it

Requires Docker (the local stack runs in containers) and the Supabase CLI.

```sh
supabase start                 # boots Postgres, Auth, Storage, Realtime, Edge Runtime
supabase db reset              # applies migrations/ in order, then runs seed.sql
supabase test db               # runs the pgTAP suites in tests/
supabase functions serve       # serves the three Edge Functions locally
supabase stop
```

From the repo root the same three are `bun run db:start`, `bun run db:reset`,
`bun run db:test`.

**Verification status:** the Docker daemon was not running in the environment where
this was written, so `supabase start` / `supabase db reset` / `supabase test db` have
**not** been executed against a live database. The SQL is written against the spec
and reviewed by hand; treat the first `supabase db reset` as the real compile step.
No remote instance was contacted.

### Demo users

Seeded through `auth.users` with a bcrypt digest — no plaintext password is stored
anywhere.

| Who | Email | Role |
|---|---|---|
| Alex Kumar | `alex.kumar.demo@example.com` | patient at CityCare |
| Dr. Sara Whitfield | `sara.whitfield.demo@example.com` | doctor at CityCare |

Password for every seeded account: `demo-password-2026`. The three queue patients
(Maria Gonzalez, James Okoro, Priya Sharma) exist as real profiles so the doctor
queue is real data rather than display strings.

### Environment

Edge Functions read `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` (injected by the CLI), plus:

| Variable | Default | Meaning |
|---|---|---|
| `AI_PROVIDER` | `stub` | Selects the `AiProvider` implementation. `stub` is deterministic and calls nothing. |
| `VOICE_PROVIDER` | unset | Unset ⇒ `voice-token` returns `501 voice_provider_unconfigured`. |

No provider key is in this repo or in the database. `AI_PROVIDER` is the seam; a real
provider implements `AiProvider` in `functions/_shared/ai.ts` and reads its key from
the function environment.

## The §4 API, row by row

Kinds are the spec's own: **T** table access under RLS (no server code — the policy
*is* the API), **R** Postgres function, **E** Edge Function, **S** Realtime.

### 4.1 Patient

| # | Spec call | Kind | Implemented as | Enforced by |
|---|---|---|---|---|
| 1 | Resolve tenant branding | T | `GET /rest/v1/hospitals_public?slug=eq.<slug>` | view + `grant select to anon` (0002) |
| 2 | My profile + details | T | `GET /rest/v1/patient_details?profile_id=eq.<uid>` | `patient_details_rw_own` |
| 3 | Save health profile | T | `PATCH /rest/v1/patient_details?profile_id=eq.<uid>` | same policy + 18+ trigger |
| 4 | Start or resume consult | R | `POST /rest/v1/rpc/start_consult` | definer fn, `consults_one_open` index |
| 5 | Consult state (poll) | T | `GET /rest/v1/consults?id=eq.<id>` (+ `my_current_draft`) | `consults_patient_read` |
| 6 | Transcript | T | `GET /rest/v1/consult_messages?consult_id=eq.<id>&order=seq` | `consult_messages_patient_read` |
| 7 | Send a turn | E | `POST /functions/v1/ai-consult` (SSE) | JWT + RLS read + `ai_record_turn` / `ai_submit_draft` |
| 8 | Mint voice session token | E | `POST /functions/v1/voice-token` | JWT + `check_quota`; returns 501 until a provider is chosen |
| 9 | Upload consult photo | R+Storage | `POST /rest/v1/rpc/create_media_upload`, then a signed PUT | definer fn + `consult-media` storage policy |
| 10 | My records | T | `GET /rest/v1/consults?patient_id=eq.<uid>&select=…,prescriptions(…)` | `consults_patient_read`, `prescriptions_patient_read` |
| 11 | A prescription | T | `GET /rest/v1/prescriptions?id=eq.<id>&select=*,prescription_items(*),investigation_orders(*)` | three read policies |
| 12 | Prescription PDF link | R | `POST /rest/v1/rpc/sign_prescription_pdf` | definer fn + `audit_log` row |
| 13 | My labs | T | `GET /rest/v1/lab_results?patient_id=eq.<uid>&order=observed_at.desc` | `lab_results_patient_read` |
| 14 | Notifications | T | `GET /rest/v1/notifications?recipient_id=eq.<uid>` | `notifications_own_read` |
| 15 | Mark read | T | `PATCH /rest/v1/notifications?id=eq.<id>` | `notifications_own_mark_read` + read_at-only trigger |
| 16 | Register push | T | `POST /rest/v1/push_subscriptions` | `push_subscriptions_own` |

### 4.2 Doctor

| # | Spec call | Kind | Implemented as | Enforced by |
|---|---|---|---|---|
| 17 | Review queue | T | `GET /rest/v1/consults?hospital_id=eq.<h>&status=eq.pending_review&order=urgency.desc,submitted_at.asc` | `consults_doctor_read` + `consults_queue` index |
| 18 | Queue live updates | S | Realtime on `public.consults`, filter `hospital_id=eq.<h>` | publication (0009); RLS filters the stream |
| 19 | Open a case | R | `POST /rest/v1/rpc/open_consult` | definer fn, writes `doctor_opened` |
| 20 | Ask Mira / dictate an edit | E | `POST /functions/v1/ai-review` (SSE) | JWT + RLS read + `ai_record_review_message` (422 on an uncited claim, regenerated once) |
| 21 | Persist a revision | R | `POST /rest/v1/rpc/revise_draft` | definer fn; 409 on a superseded base, 422 on a safety block |
| 22 | **Approve** | R | `POST /rest/v1/rpc/approve_consult` | definer fn + the gate trigger; the only write path to `prescriptions` |
| 23 | Reject | R | `POST /rest/v1/rpc/reject_consult` | definer fn + `reviews_patient_message_required` |
| 24 | Escalate → appointment | R | `POST /rest/v1/rpc/escalate_consult` | definer fn |
| 25 | Patient record panel | T | `GET /rest/v1/patient_details?profile_id=eq.<p>` + labs + prior consults | `patient_details_read_treating` (`shares_consult_with`) |
| 26 | Feedback to Mira | T | `POST /rest/v1/mira_feedback` | `mira_feedback_doctor_insert` |
| 27 | Doctor voice token | E | `POST /functions/v1/voice-token` with `mode:"coordinator"` | as #8 |

### 4.3 Operator / shared

| # | Spec call | Kind | Implemented as | Enforced by |
|---|---|---|---|---|
| 28 | Consult trace | T | `GET /rest/v1/consult_trace?consult_id=eq.<id>&order=at` | `security_invoker` view over 8 tables |
| 29 | Trace search | R | `POST /rest/v1/rpc/search_consults` | definer fn + `consult_messages_fts` |
| 30 | Export trace | R | `POST /rest/v1/rpc/export_consult_trace` | definer fn + `audit_log` row |
| 31 | Lab report upload | R+Storage | `POST /rest/v1/rpc/create_lab_upload`, then a signed PUT | definer fn + `lab-reports` policies |
| 32 | Transition allowlist | T | `GET /rest/v1/consult_transitions` | `consult_transitions_read` |
| 33 | Cron: SLA warn / expire / abandon | R | `select public.run_consult_timers();` | scheduled by `cron.schedule` when pg_cron is present (0009) |

**33 of 33 rows implemented.** 16 of them (#1, 2, 3, 5, 6, 10, 11, 13, 14, 15, 16, 17,
25, 26, 28, 32) need **no code at all** — a policy, a view and a grant are the whole
implementation. The remaining 17 are 12 Postgres functions, 3 Edge Functions (#8 and
#27 share one) and 1 Realtime publication.

Two rows are implemented but **partial**, and both are called out again under
Assumptions:

- **#8 / #27 `voice-token`** authorizes the caller, enforces the quota and pins and
  hashes the session config, then returns `501 voice_provider_unconfigured`. §7
  assumption 8 says the voice provider is unsettled; minting a session for a provider
  nobody has chosen would be inventing the decision.
- **#9 / #12 / #31** return `{bucket, path, expires_at}` rather than a materialized
  `upload_url`. A signed URL is minted by the Storage API, not by Postgres; the RPC
  does the validation the spec gives it (MIME, size, row state, id-only key) and the
  client exchanges the path via `createSignedUploadUrl` / `createSignedUrl`, which the
  §5.3 storage policies authorize. The security boundary is unchanged — no client ever
  holds a bucket-wide grant.

### Error envelope

RPCs raise SQLSTATEs of the form `PTnnn`, which PostgREST maps to HTTP status `nnn`;
MESSAGE carries `code`, DETAIL carries `message`. The Edge Functions emit the §4
envelope directly: `{ code, message, detail, retryable }`, and translate PostgREST
errors into it (`fromPostgrest` in `functions/_shared/http.ts`).

## What the database enforces, and what it cannot

| Invariant | Where |
|---|---|
| A prescription requires exactly one review | `prescriptions.review_id NOT NULL UNIQUE` |
| That review must be approving, by the same doctor, on the same consult | `t_prescriptions_gate` |
| The signed draft hash must still match the draft | same trigger, and again in `approve_consult` |
| No client role may write `prescriptions`, `prescription_items` or `reviews` | `REVOKE … FROM anon, authenticated, service_role` |
| `content_hash` cannot drift from the content it hashes | `GENERATED ALWAYS AS (… digest …) STORED` |
| A draft version is never edited in place | `t_ai_drafts_immutable` + `ai_drafts_current` partial unique index |
| A draft flag can only come from the validator | `t_ai_drafts_validator_flags` |
| Status moves only along the allowlist, and only by the allowed actor | `consult_transitions` + `t_consults_transition` |
| Every status change leaves a trace row | the same trigger writes it |
| Transcript, events, reviews and the audit log are append-only | `reject_write()` triggers |
| An approved prescription is immutable | `t_prescriptions_immutable` |
| One open consult per patient per hospital | `consults_one_open` partial unique index |
| Patients are 18+ | `t_patient_details_adult` |

Two things Postgres will not express as written in the spec, and what was done
instead:

- **`current_setting('vd.actor')` has no default.** The spec's trigger reads it; if a
  writer forgets to set it the transition is refused rather than allowed. That is the
  safe direction, and it means every status change must go through an RPC that names
  its actor.
- **`§3.4 layer 5`'s dedicated `vd_clinical` owner role** is not created. The definer
  functions are owned by `postgres` and every DML grant on `prescriptions` is revoked
  from `anon`, `authenticated` and `service_role`. A non-superuser owner under
  `FORCE ROW LEVEL SECURITY` would itself need a bypass policy on `prescriptions`,
  which is a wider hole than the one it closes.

## Tests

```sh
supabase test db
```

35 assertions across three pgTAP suites, all of them running against the real schema.

- `01_approval_gate.test.sql` (12) — a prescription with no review, with a *rejected*
  review, with a different doctor's review, and with a stale draft hash are each
  refused by the database; the correct one succeeds; that review cannot then sign a
  second prescription; the result cannot be edited; and neither `authenticated` nor
  `service_role` holds an `INSERT` grant on `prescriptions` or `reviews`.
- `02_state_transitions.test.sql` (9) — with no actor set, with the wrong actor, and
  for a pair absent from the allowlist, the update raises; the allowed move succeeds
  and writes its own `status_change` event; and that event cannot be rewritten.
- `03_rls_isolation.test.sql` (14) — running as `authenticated` with patient B's JWT
  claim, patient A's consult, transcript, draft, prescription, labs and clinical
  profile all return **zero rows**, appending a turn to A's consult raises `42501`,
  and `approve_consult` raises `PT403`; the same queries as patient A return one row
  each; a doctor of hospital Y sees zero rows for hospital X's consult and its trace,
  while the doctor of hospital X sees one.

The suites run as `postgres`, which bypasses RLS for fixture setup; every assertion
about access is made after `SET LOCAL ROLE authenticated` and a `request.jwt.claims`
setting, so it exercises the policy and not the setup role.

## Assumptions taken

From `docs/DATA-MODEL.md` §7, safest option chosen and implemented:

1. **§7.1 — slots as a table.** Implemented as `consult_slots`, not
   `consults.slots` JSONB. The conclude gate in `ai_submit_draft` is a `NOT EXISTS`
   over required slots, which a JSON blob could not answer.
2. **§7.2 — `ai_confidence` / `ai_flags` live on the draft**, not the consult, so a
   doctor's signature binds to the version those values belong to.
3. **§7.3 — nobody owns the allergy-class map.** `drug_class_map` is a table with a
   `ruleset_version`, seeded with the penicillin family and a cephalosporin
   `caution`, and `check_drug_safety` records the version on every check. A `block`
   stops the draft being written at all (`needs_human`), which is the failure
   direction that does not need a signed-off map to be safe.
4. **§7.4 — prescription items are rows**, not `items jsonb`, per §3.1.
5. **§7.5 — retention has no number.** None is invented. `run_storage_retention()`
   reads `hospitals.ai_config.audio_retention_days` and deletes nothing when it is
   absent or zero. Clinical objects are never deleted by a user action.
6. **§7.6 — consult audio.** The bucket exists but retention is **off by default**;
   with no `audio_retention_days` set, nothing is ever written to it by a policy
   (writes are `service_role`-only) and nothing is swept.
7. **§7.7 — `needs_human` is in the enum**, reachable from `active` (AI refusal or a
   safety block) and from `pending_review` (system), and decidable by a doctor.
8. **§7.8 — voice provider unsettled.** `voice-token` does everything
   provider-independent and refuses with `501` rather than guessing. `agent_invocations`
   records both token and audio-second cost so it survives either decision.
9. **§7.9 — patient-visible reviewer identity.** The narrower reading is taken: a
   patient may read the profile and clinician details of a doctor who reviewed *their*
   consult, and no other clinician. Registration number is exposed through
   `doctor_card` because PRD UC-3.2 requires the name and §3.6 lists the number, but it
   is one view to withdraw if the answer is no.
10. **§7.10 — multi-hospital isolation.** T-4 is taken literally: `patient_details` is
    global (one row per profile), while `consults`, `lab_results`, `prescriptions` and
    everything consult-scoped carry `hospital_id` and never cross. `open_consult`
    returns only same-hospital labs and prior consults.

## Not wired to the frontend

Nothing under `apps/` was read except `src/store/seeds.ts` and `src/lib/core/index.ts`
(for shapes), and nothing under `apps/` or `docs/` was modified. `prescription_items`
is field-for-field `RecItem`, so §6's adapter path stays open, but no client code here
consumes it.
