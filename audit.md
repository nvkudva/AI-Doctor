# Production Audit — AI Doctor

Date: 2026-10-27. Method: seed-data expansion, independent QA agent (deep code +
build inspection), product-manager agent (PRD vs built), lead-engineer fixes.
User absent; every judgement call is recorded as a decision in work-summary.md.

## Verification baseline

- `bun run typecheck` (apps/web): PASS, no errors.
- `bun run build`: PASS, 266 modules, PWA precache 23 entries / ~760 KiB.
  Model chunks (Kokoro, Transformers, ONNX WASM) stay lazy, never precached.
- Browser smoke (dev server): patient home renders new seed medication,
  appointments, labs with no console errors; doctor queue renders 8 waiting /
  2 urgent, urgent-first, from the expanded seeds.
- Voice loop (earlier, same codebase): Kokoro speak → Whisper transcript →
  SmolLM2 reply → Kokoro speak, OS voice never used.

## QA findings and disposition

### P1 — all fixed

1. Red-flag check never called. `checkRedFlag()` existed in narration.ts but
   no caller; emergency handling depended on the small model's own JSON.
   Fixed: useConsult runs it every turn; a hit forces the urgent reply,
   low confidence, the red-flag label in flags, and files an urgent
   in-person-assessment case for the doctor (useConsult.ts).
2. Duplicate/concurrent consult submission. `handleUser` had no in-flight
   guard; double sends raced `ensureConsult` into two consults/cases.
   Fixed: single-flight ref held across the model turn (useConsult.ts).
3. Client auth gate trusted stale/forged localStorage role when Supabase is
   configured. Fixed: a resolved null session, or SIGNED_OUT, now clears the
   persisted user (shell/auth.tsx). Demo (unconfigured) mode keeps its
   local-user model by design.
4. False approval announcement. Supabase `decide()` stamped a case and the UI
   announced "Approved and sent" even with no draft loaded or before the RPC
   resolved. Fixed: missing draft refuses with a notice and no stamp;
   `decide()` returns success (RPC result in Supabase mode, true locally);
   DoctorApp announces only on success (SupabaseClinic.tsx, LocalClinic.tsx,
   DoctorApp.tsx, store/types.ts).

### P2 — fixed

- Sign-out leaked composer drafts (`vd_consult_draft`, `vd_review_draft`):
  clearLocal now removes them and the auth key (storage.ts).
- Brain could wedge on "thinking" forever: 120 s timeout on the configured
  brain; failure surfaces as a retryable error (models/llm.ts).
- "Listening" showed while Whisper was still downloading and speech was
  lost: status flips only when capture actually starts (`onStart` through
  stt.ts → voice/index.ts → useConsult/useReview).
- Overlapping Kokoro lines dropped the first line's continuation: superseded
  generations now resolve (voice/kokoro.ts).
- Retry duplicated the failed user turn in transcript, model history and
  narration slot: retry now removes the turn and its slot answer first
  (useConsult.ts).
- Check-in follow-up was a dead end on a finished consult: it now opens
  note-mode against the approved consult, so the reply reaches the doctor
  (PatientFlow.tsx). Check-in dismiss now snoozes 24 h in both stores.
- Reload lost the in-progress consult despite persistence: draft transcript
  + narration slots are restored into the panel on mount (useConsult.resume,
  PatientFlow.tsx). The 30-minute abandonment timer still closes stale visits.
- "Order medicine" was local-only fake state: the order is persisted per
  plan and survives reload (RecommendationScreen.tsx, storage.ts). It is a
  recorded intent, not a pharmacy integration (see Deferred).
- Supabase-mode test booking vanished on refresh: locally booked slots are
  persisted and merged across appointment refreshes (SupabaseClinic.tsx).
- Dose marks attached to the wrong medicine after a new approval (index
  keys): dose ids are keyed by medicine + timing text (store/doses.ts).
- Demo sign-in navigated before real auth resolved (configured mode):
  signInDemo is awaited and navigation happens only on success
  (auth.tsx, LoginPage.tsx).

### P3 — fixed / noted

- Doctor "On duty" switch was cosmetic: choice now persists across reload.
  Gating queue intake on it needs the assignment backend (Deferred).
- Dead Terms/Privacy/help links removed from the login screen; sign-in help
  is now plain guidance text (real legal pages: Deferred, needs legal copy).
- Persistent AI disclosure added to the Mira panel title: "AI — a doctor
  reviews every plan" (PM P2, MiraPanel.tsx).
- Noted, not changed: queue filter tablist lacks full tab keyboard pattern;
  first-consult model download is ~500 MB across three models (lazy, cached,
  never precached) — measured and accepted in work-summary decisions.

## Product (PM) audit summary

Built and demo-ready: role-gated modules, consult lifecycle + status
tracking, doctor queue (urgent-first, realtime + poll), approve/edit/reject
with reason behind a UI-only signing gate, visit history + prescription
detail, dose tracking + day-3 check-in, appointments/booked tests, seeded
labs with reference ranges, in-app notifications, installable PWA.

Partial (works, thin): patient profile fields, lab report delivery, doctor
draft editing (via Mira revise, no manual form), SLA sweep (local cases),
Settings rows, per-tenant branding (static manifest).

Missing / stale-item closure:

- PM flagged an "unguarded hard-coded-drug demo engine" as the offline
  brain. That engine no longer exists: the scripted demo brain and the
  `window.claude` path were deleted in the fallback-removal change
  (lib/api/ai.ts is a 24-line seam over config-chosen SmolLM2/API). README
  wording about it is stale; see Deferred docs item.
- Doctor email/password sign-in: missing (Google + demo accounts only).
- Web push: missing (in-app notifications only).
- Prescription share/print/PDF and pharmacy ordering: missing.
- Admin/operator console, consult-trace UI, Mira feedback UI, photo upload
  with vision analysis: missing.
- Allergy-class map content (amoxicillin/co-amoxiclav cross-check) is a
  clinical-content decision, not an engineering one: Deferred pending
  clinician sign-off. The code never fabricates an allergy attestation.

## Seed data added (store/seeds.ts, +249 lines, existing entries untouched)

- Queue: 10 new cases (13 total) across pending_review / pending / approved /
  changes / rejected, urgency routine→urgent, new conditions: back pain,
  anxiety/insomnia, ear pain, urinary symptoms, gallstones, COPD decline.
- Consult history +6, prescriptions +5, appointments +4, labs +5, doctor
  slots +6, lab values +6 (12 total). Check-ins derive from approved cases,
  so the 3 new approved cases feed the day-3 flow.

## Deferred (with owner decision recorded in work-summary.md)

Doctor email/password form; web push (VAPID); prescription PDF/share and
pharmacy ordering; admin console; consult-trace UI; manual draft-edit form;
photo vision; per-tenant PWA branding; allergy-class clinical content;
queue tablist keyboard pattern; README refresh for the removed demo engine;
Supabase-mode end-to-end test against a funded backend (none in this env).
