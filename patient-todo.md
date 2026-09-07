# Patient module — backlog

Built: photo upload in a consult, book a test from a plan, real appointments on
Home, lab detail with reference range, plain-language explanations, lab trends,
notification centre, dose schedule with check-off, day-3 symptom check-in.

The cut line at the bottom is deliberate, not an oversight.

## P0
- [x] Photo/document upload during a consult — patient attaches a rash or report; Mira references it
- [x] Book a test from an approved plan — pick lab and slot, writes an appointment (needs schema: slot availability)
- [x] Real appointments on Home — read `appointments` instead of the hardcoded seed
- [ ] Real slot availability — booking currently offers a fixed grid with two slots marked taken (needs schema)
- [ ] Lab directory — the two labs on the booking screen are hardcoded (needs schema)
- [ ] Send the attached photo to Mira — the image reaches the transcript and the doctor's case, but the model is told about it in words, not shown it (`consult_media`)
- [ ] Dose reminders — the schedule exists; nothing pushes at dose time (needs schema)
- [ ] Move dose ticks and check-in answers off the device — both live in localStorage (needs schema)
- [ ] Cancel or reschedule an appointment — status change plus a new slot (needs schema: slot availability)
- [x] Lab result detail with reference range — value, unit, range, in/out of range
- [x] Plain-language result explanation — one honest sentence per abnormal analyte
- [ ] Open/download lab report file — the stored `report_path` becomes a real link
- [ ] Download approved prescription PDF — signed, shareable, printable
- [ ] Emergency / red-flag escalation — always-visible urgent-care path (needs schema)
- [ ] Real "Order medicine" — replace the no-op button with a fulfilment request (needs schema)
- [x] Notification centre with deep links — unread list, mark read, jump to target
- [ ] Offline copy of an approved plan — cached and readable with no network
- [ ] Full health profile editing — conditions and current medications, not just three fields
- [ ] Investigation order status tracker — ordered → scheduled → collected → resulted
- [ ] Consult transcript in History — read back what was actually said
- [ ] Delete the fake insurance/payment tiles — the system holds no such data

## P1
- [ ] Prescription refill / repeat request — routed to doctor review (needs schema)
- [x] Medication schedule (no push reminders yet) — per-drug times, push at each dose (needs schema)
- [x] Adherence check-off — mark a dose taken; the doctor sees compliance (needs schema)
- [x] Post-plan symptom check-in — day-3 prompt: better, same, worse (needs schema)
- [x] Lab trend chart per analyte — value against range over time
- [ ] Appointment reminders and calendar add — push at T-24h/T-1h, .ics export
- [ ] Secure message to the clinic — non-urgent question outside a consult (needs schema)
- [ ] Upload an outside document to records — a prior hospital report into the file
- [ ] History search and filter — by type, date, keyword
- [ ] Explicit resume-or-discard for interrupted consults — instead of a silent sweep
- [ ] Pre-consult record confirmation — confirm on-file facts before Mira starts
- [ ] Language selection for the consult — voice and UI (needs schema)
- [ ] Accessibility settings — text size, reduced motion, text-only consult mode (needs schema)
- [ ] Notification preferences — which kinds, which channel, quiet hours (needs schema)
- [ ] Consent and data-sharing controls — who may read the record, revocable (needs schema)
- [ ] Download all my records — full export bundle
- [ ] Care-plan progress view — steps done vs outstanding (needs schema)

## P2
- [ ] Pharmacy collection status — dispensed, ready, collected (needs schema)
- [ ] Dependants / family accounts (needs schema)
- [ ] Insurance and payment on file — real coverage record, copay, receipts (needs schema)
- [ ] Access audit for the patient — who opened my record and when
- [ ] Video appointment join — patient side of a doctor-requested call
- [ ] Rate the consult — feedback on Mira and the plan (needs schema)

## Deliberately not building
- **Payments, insurance claims, pharmacy logistics.** Nothing in the schema models money or stock; a faked copay tile is worse than no tile.
- **Dependants, guardian consent, minors.** The PRD scopes the MVP to adults 18+ and a database trigger enforces it. A family switcher contradicts a decision already made in Postgres.
- **Free-text secure messaging to the clinic.** An unbounded inbox nobody is rostered to answer, competing with the consult as the way to reach a clinician.
