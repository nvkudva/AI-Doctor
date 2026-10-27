# Work Summary — autonomous session, 2026-10-27

## What was delivered

1. Local voice loop, then hardened: Kokoro-82M TTS, Distil-Whisper STT,
   SmolLM2-360M brain, all in-browser; providers switch in one file
   (lib/models/config.ts); narration scripts + slots per symptom.
2. All silent fallbacks removed: no OS voice, no browser recogniser, no
   scripted demo brain. Turns wait for the real model or surface an error.
3. Seed data expanded (+249 lines): 13 queue cases, 8 consults, 6 Rx,
   5 appointments, 7 labs, 16 doctor slots, 12 lab values.
4. QA agent deep test + PM agent feature audit (full text in audit.md).
   All 4 P1 QA findings fixed; 11 P2 fixed; 3 P3 fixed/noted.
5. Typecheck PASS, build PASS, browser smoke PASS (patient home + doctor
   queue on seeded data, no console errors).

## Decisions made without the user (best judgement, reversible)

- D1 Scope of "remove the fallback": removed all three (OS TTS, browser STT,
  scripted brain), not just the robotic voice. If a model cannot load, the
  turn errors or resolves unsaid — never silently degrades.
- D2 Red-flag safety is deterministic code (narration checkRedFlag), not a
  model judgement. A hit files an urgent case for the doctor immediately.
- D3 "Declined/in-person" seed status mapped to the existing 'rejected'
  status (no such ConsultStatus exists); rejectReason carries the wording.
- D4 Check-ins stay derived from approved cases (no standalone seed array);
  added a persisted 24 h snooze for dismiss.
- D5 `decide()` now returns success; "Approved and sent" is announced only
  after the RPC lands. Local mode returns true synchronously as before.
- D6 Demo (unconfigured) mode keeps trusting its local demo user — that is
  its auth model. The stale/forged-role fix applies to configured mode.
- D7 Order-medicine is a persisted intent, labelled honestly as an order
  record; no fake pharmacy. Booking in Supabase mode is persisted locally
  until an appointments insert API exists.
- D8 Deferred, deliberately, as too large or needing non-engineering input:
  doctor email/password sign-in, web push, Rx PDF/share + pharmacy, admin
  console, trace UI, manual draft form, photo vision, per-tenant branding,
  allergy-class map content (needs clinician sign-off), queue tablist
  keyboard pattern, README refresh. All listed in audit.md.
- D9 First-visit voice is slower by design: ~500 MB of models download once
  (lazy, browser-cached, never PWA-precached) instead of instant robotic
  fallback. Panel-mount warm-up hides most of it.
- D10 Kept the name Dr. Mira (codebase name) over the spoken request's
  "Dr Maya".

## Known limitations

- SmolLM2-360M replies are warm but shallow; JSON contract is best-effort.
  The frontier switch is one file (config.ts) when quality matters.
- Voice turn latency on WASM is tens of seconds, not conversational yet.
- Supabase mode was not exercised against a live funded backend in this
  environment; local demo mode carried the runtime verification.
- No automated test suite exists in the repo; verification was typecheck,
  build, and real-browser probes.

## Ship record

- Commit: bf79891 on branch t3/natural-browser-tts-options, pushed to origin.
- Deploy: Cloudflare Worker `aidoctor`, version 71bc4493-3559-47ba-ab62-27257a76dcbe.
- Live: https://aidoctor.nvkudva.workers.dev — smoke: /, /patient,
  /doctor/reviews all HTTP 200, title "AI Doctor".
- Note: deployed from the feature branch on the user's explicit instruction
  for this task, rather than post-merge from main.
