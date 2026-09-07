# Doctor module — backlog

Built: queue purity, day calendar, shift dashboard, SLA breach counter, per-row
countdown, escalate to appointment, safety checks inline, no-show marking.

## P0
- [ ] Claim a case — set `assigned_doctor_id` on open so two doctors cannot double-review
- [ ] Unassigned vs mine toggle — split the hospital pool from my claimed work
- [ ] E-signature at approval — bind the signature to doctor identity and `draft_hash` before the gate
- [ ] Prescription supersede flow — issue a corrected version via `supersedes_id`, never edit
- [ ] Consult audit trail view — render `consult_trace` as a medico-legal timeline
- [ ] Draft diff view — what changed between AI draft versions and against my edits
- [ ] Doctor availability templates — recurring open blocks per weekday (needs schema)
- [ ] Clinic session calendar — named sessions with capacity limits, replacing the hardcoded 09–13 / 16–20 (needs schema)
- [ ] Cancellation with reason — who cancelled and why (needs schema)
- [ ] Escalation ladder config — per-hospital SLA thresholds and who is notified at each tier (needs schema)
- [ ] Escalation slot picker — escalate currently books the next half hour; the doctor should choose

## P1
- [ ] Next-case chaining — after a decision, jump straight into the next queued case
- [ ] Week view — seven-day capacity and booking overview
- [ ] Waitlist — queue patients for a slot and offer it on cancellation (needs schema)
- [ ] Follow-up recall scheduling — book a return visit at approval time (needs schema)
- [ ] Overbooking rules — allow N over capacity per session with a warning (needs schema)
- [ ] Handover notes — leave a note on a case for the next doctor on shift (needs schema)
- [ ] My patient panel — searchable list of patients I have reviewed
- [ ] Abnormal lab inbox — surface critical and high `lab_results` on my patients
- [ ] Batch send-back — return several low-risk drafts to Mira together
- [ ] Reviewer productivity report — reviews per session, median decision time from `time_in_consult_ms`
- [ ] On-call rota — who is watching the queue per shift; route escalations there (needs schema)
- [ ] Referral to specialist — refer a consult to another clinician or department (needs schema)
- [ ] Decline reason library — hospital-configurable templates instead of one hardcoded string (needs schema)

## P2
- [ ] Care-team messaging — doctor-to-doctor thread attached to a consult (needs schema)
- [ ] Capacity and utilisation report — booked vs available minutes, no-show rate by session
- [ ] Encounter documentation — clinician note distinct from the AI note (needs schema)
- [ ] Coding and billing hooks — attach an ICD/CPT-style code at approval (needs schema)
- [ ] Investigation order tracking — follow ordered → resulted for tests I ordered

## Deliberately not building
- **Batch approve of prescriptions.** A multi-select approve undercuts the gate enforced in Postgres — the product's whole claim is that a licensed human reads each plan.
- **Billing, referral routing, care-team messaging.** Back-office integrations with no counterpart in the patient module; each needs a real downstream system to be credible.
- **Availability/slot-template authoring UI.** Seed the sessions instead; build the scheduling admin when a pilot hospital has to configure its own rota.
