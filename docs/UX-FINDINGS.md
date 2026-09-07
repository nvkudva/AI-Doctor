# AI Doctor — UX audit findings

Flow-level audit (information architecture, flow gaps, dead ends, feedback, state
survival). Pure visual/CSS issues are out of scope and deliberately excluded.

**How this was produced:** the running app at `http://localhost:3003` was driven with
Playwright (Chromium) at 390×844, 900×1000 and 1400×1000, signed in through the demo
login as both "Fake patient" and "Fake doctor". Every finding below was observed in the
running app; file references point at the code most likely responsible.

**Severity:** P1 = blocks a task · P2 = causes confusion or rework · P3 = polish.

**Standard repro prelude (used by every entry unless stated otherwise):**
`/login` → click "I confirm I am 18 or older" → click "Fake patient" (or "Fake doctor").
"Run a consult" means: open the Dr. Mira panel from the nav orb (or the "Start a
consultation" card) and send six typed turns — `I have a fever`, `since yesterday`,
`39 degrees`, `yes a cough`, `no`, `thats all` — which reliably ends the consult and
routes to `/patient/recommendation`.

---

## P1 — blocks a task

### UX-01 · One completed consult creates two identical cases
**App / route / breakpoint:** Patient `/patient` → Doctor `/doctor` · all breakpoints.

**What happens:** Running one consult to completion produces **two** `pending_review`
cases. Verified in `localStorage.vd_state_v1` (`liveQueue: pending_review,pending_review`
after a single consult, reproduced in 3 separate runs) and in the doctor's queue, which
renders two "Alex Kumar — Fever management" cards. The patient's home card reads the
*first* of the two, so after the doctor reviews one case the patient's home still shows
"PENDING REVIEW" forever, and the second case sits in the doctor queue as unreviewed
clinical work.

**What should happen:** One consult = one case. Consult submission must be idempotent —
guard the completion callback so it can fire only once per consult.

**Likely responsible:** `apps/web/src/lib/voice/index.ts:64-66` — `u.onend` and
`u.onerror` are both wired to the same one-shot `done()` with no guard, and Chromium
fires both when `speechSynthesis.cancel()` interrupts an utterance (the next `speak()`
call at `apps/web/src/modules/patient/components/PatientFlow.tsx:79` does exactly that).
`done()` is the `after` callback that submits the consult:
`apps/web/src/modules/patient/useConsult.ts:178-189`.

---

### UX-02 · The doctor's decision does not survive a page reload
**App / route / breakpoint:** Doctor `/doctor/case/:id` · all breakpoints.

**What happens:** Open `/doctor/case/c1`, click "Approve & send" — header goes
"2 pending" → "1 pending", pill flips to APPROVED. Press reload. The header is back to
"2 pending" and c1 is PENDING again. The same is true for decline and "send back for
changes". A doctor who refreshes, follows a link, or reopens the tab will re-review cases
they have already signed, and there is no warning that the decision was dropped.

**What should happen:** A review decision is durable the moment it is made, and the queue
reflects it after a reload.

**Likely responsible:** `apps/web/src/store/ClinicProvider.tsx:39-41` — only
`queue.filter(c => c.mine)` is persisted, so decisions on any case that is not the local
demo patient's own are held in memory only.

---

### UX-03 · Reloading or returning to the plan screen loses the plan
**App / route / breakpoint:** Patient `/patient/recommendation` · all breakpoints.

**What happens:** Finish a consult (you land on `/patient/recommendation` showing the
plan), then reload. The screen becomes "No plan to show yet — Finish a consult and your
plan will appear here. [Back home]" even though the case exists in storage with status
`pending_review`. The same empty screen appears if the patient later navigates back to
`/patient/recommendation` from anywhere. The case data is persisted; only the in-memory
`rec` is not, so the plan the patient was just given is unreachable.

**What should happen:** `/patient/recommendation` should rehydrate the patient's open (or
most recent) case from the store; the empty state should be reserved for a patient who
genuinely has no consult.

**Likely responsible:** `apps/web/src/modules/patient/components/PatientFlow.tsx:53`
(`const [rec, setRec] = useState<Recommendation | null>(null)`) and the render gate at
`PatientFlow.tsx:167-179`, which falls through to `EmptyRecommendation` whenever `rec`
is null.

---

### UX-04 · An approved prescription never reaches Records in readable form
**App / route / breakpoint:** Patient `/patient/records?tab=history` · all breakpoints.

**What happens:** After the doctor approves, History gains a row "Fever management ·
APPROVED · Today · Dr. Mira" whose body is the *advice* string. It has no "View details"
affordance (unlike the two seeded rows) and no dosage, timing, item list, doctor
attribution or "why". The plan screen's own "Saved to History" button navigates to this
list, so the patient is told their plan is saved and then shown a row that does not
contain it. Combined with UX-03, the prescription the patient was prescribed is
unreadable anywhere in the app once they leave the plan screen.

**What should happen:** The approved record carries the full recommendation (items,
dosage, timing, why, advice, reviewing doctor, date) and opens into the plan view — that
is UC-3 in the PRD ("An approved consult shows the doctor's name, date, prescription
items with dosage/timing/notes, advice").

**Likely responsible:** `apps/web/src/store/ClinicProvider.tsx:77-83` — the record is
built as `{ title, date, status, note: rec.advice }` with no `detail`; the expandable
body in `apps/web/src/modules/patient/components/RecordsScreen.tsx:165-186` renders only
when `c.detail` exists.

---

### UX-05 · A declined plan disappears; the patient never sees the reason
**App / route / breakpoint:** Patient `/patient` and `/patient/records` · all breakpoints.

**What happens:** Run a consult, go to `/doctor`, open the live case, "More decision
actions" → "Decline…" → "Don't approve". Return to `/patient`: home still shows
"PENDING REVIEW", "From your doctor" says "No messages", and
`/patient/records?tab=history` contains no entry at all for the declined consult. The
decline reason the doctor wrote — the whole point of the decline sheet — is reachable
only if the patient happens to still have the plan screen mounted in the same tab.

**What should happen:** A decline creates a record the patient can find later, showing
the reason and the concrete next step (PRD §3A.5: "Rejection is never a dead end").

**Likely responsible:** `apps/web/src/store/ClinicProvider.tsx:66-84` — only the
`approved` branch writes a `UserConsult`/prescription; `rejected` and `changes` write
nothing the patient can see.

---

### UX-06 · Approving or declining notifies the patient nowhere
**App / route / breakpoint:** Patient `/patient` (home, "From your doctor") · all breakpoints.

**What happens:** After both an approve and a decline, the home section "From your doctor"
still reads "No messages. Review decisions land here." and the bell shows nothing. The
plan screen's own timeline promises "You'll be notified when it's confirmed". Nothing is
ever pushed to the patient — the only signal is the status pill on a card the patient
cannot open (UX-08).

**What should happen:** Every review decision pushes a patient-facing notice ("Dr.
Whitfield approved your plan" / "…could not approve — here's what to do") that opens the
plan.

**Likely responsible:** `apps/web/src/store/ClinicProvider.tsx:66-84` (`decide` never
calls `pushNotice`); consumer at
`apps/web/src/modules/patient/components/HomeScreen.tsx:89-102`.

---

### UX-07 · A prescription can be approved by typing in the chat panel
**App / route / breakpoint:** Doctor `/doctor/case/:id` · all breakpoints.

**What happens:** Open `/doctor/case/c2`, tap the Dr. Mira orb, type "Approve and send"
(it is also offered as a one-tap suggestion pill). The case is approved immediately —
pending count 2 → 1 — with no confirmation step, no draft-vs-final review, and no
explicit signing action. PRD UC-2.6/D-9 require the opposite: "The approval action itself
is always an explicit UI action by the authenticated doctor, never voice-triggered." The
file's own header comment claims "Approval stays UI-only".

**What should happen:** A conversational approve request should stage the decision and
require the doctor to press the real Approve control; the suggestion pill should read
"Draft an approval" or be removed.

**Likely responsible:** `apps/web/src/modules/doctor/useReview.ts:124-128` (`action ===
'approve'` calls `onApproveRef.current()` directly); pills at `useReview.ts:28-33`.

---

### UX-08 · Mira confirms an approval that never happened
**App / route / breakpoint:** Doctor `/doctor` (Home/Appointments/Reviews tab, no case
opened) · 900 and 1400 wide.

**What happens:** On `/doctor` with no case explicitly selected — the default state at
tablet/desktop, where a case is nevertheless displayed in the middle pane — open the Mira
orb and type "Approve and send". Mira replies "Thank you, I'll notify the patient right
away." and **nothing is approved**: the header stays at "2 pending" and the case stays
PENDING. The doctor is told a clinical action succeeded when it did not.

**What should happen:** Either the command acts on the case currently shown, or Mira
refuses with "Open the case first". A confirmation must never be spoken for an action
that did not execute.

**Likely responsible:** `apps/web/src/modules/doctor/DoctorApp.tsx:106-110` — `onApprove:
() => ac && clinic.decide(...)` silently no-ops when `ac` (the URL-selected case) is
null, while `useReview` has already spoken the success line.

---

### UX-09 · Mira presents a different case from the one on screen
**App / route / breakpoint:** Doctor `/doctor` · 1400 wide (Appointments tab + "Urgent"
filter).

**What happens:** On `/doctor` at 1400, click "Appointments", then the "Urgent" filter
(no seeded case is urgent). The queue pane reads "Nothing in this list", the case pane
shows an empty state — and opening the Mira orb makes her present **Maria Gonzalez's**
case aloud in full clinical detail ("…dry, non-productive cough for ~2 weeks… I'm
recommending Chest X-ray, Loratadine 10 mg"). The doctor hears a case presentation for a
patient who is not on screen; the same mismatch applies whenever the filtered/tab list
and the unfiltered queue disagree on their first item.

**What should happen:** Mira's session is bound to exactly the case rendered in the case
pane, and refuses to present when there is none.

**Likely responsible:** `apps/web/src/modules/doctor/DoctorApp.tsx:101-102` — `paneCase =
ac || visible[0]` (what is drawn) versus `reviewCase = ac || queue[0]` (what Mira is
given at `DoctorApp.tsx:106-107`).

---

### UX-10 · "Send back for changes" is a dead end for both sides
**App / route / breakpoint:** Doctor `/doctor/case/:id` → Patient `/patient/recommendation` ·
all breakpoints.

**What happens:** "More decision actions" → "Send back for changes" sets the case to
`changes` with no prompt for *what* should change and no message to anyone. The case then
fails `isReviewable`, so it vanishes from Reviews, from "Next up" and from the pending
count (verified: pending 2 → 1, Maria gone from the Reviews list) while never becoming a
finished decision. Nothing in the doctor UI can move it forward again. On the patient side
the plan screen shows "Dr. Whitfield is adjusting your plan — you'll see the final version
here", which will never arrive.

**What should happen:** Either collect the requested changes and keep the case in the
queue as actionable, or remove the action until the edit flow exists.

**Likely responsible:** `apps/web/src/modules/doctor/DoctorApp.tsx:231`
(`onEdit={() => clinic.decide(paneCase.id, 'changes')}`) with
`apps/web/src/lib/core/index.ts:37-46` (`changes` is neither open nor reviewable).

---

### UX-11 · Once a plan is pending, the Mira orb stops working
**App / route / breakpoint:** Patient, all routes · 1400 wide (and 900).

**What happens:** After a consult completes, tapping the Dr. Mira orb never reopens the
panel again. On `/patient/recommendation` it does nothing at all (no panel, no
navigation). From `/patient/records` it silently yanks the user to
`/patient/recommendation` with no panel and no explanation of why they were moved. The
consultation transcript ("Consultation notes") becomes permanently unreachable, and the
patient has no way to ask Mira anything while waiting — contradicting PRD MC-4/MC-5
("Tapping the orb maximizes… Mira is always one tap away").

**What should happen:** The orb always opens the panel. With a review pending, the panel
should explain the state and offer the allowed action (add a note to the pending consult
per PRD §3A.5), rather than hijacking navigation.

**Likely responsible:** `apps/web/src/modules/patient/components/PatientFlow.tsx:113-133`
— `startConsult` returns early after `nav('/patient/recommendation')` without ever
setting `miraOpen`, and `toggleMira` routes through it.

---

### UX-12 · "Ask a follow-up" does nothing while a review is pending
**App / route / breakpoint:** Patient `/patient/recommendation` · 390 and 1400 wide.

**What happens:** The primary button on the pending plan screen is "Ask a follow-up".
Clicking it produces no visible change whatsoever — same URL, no panel, no message
(verified: URL unchanged, dialog count 0). It is the only affordance offered to a waiting
patient, and it is inert.

**What should happen:** Open Mira for a note attached to the pending consult, or replace
the button with the real waiting-state action ("Add a note for the doctor").

**Likely responsible:** `apps/web/src/modules/patient/components/RecommendationScreen.tsx:153`
wired to `onFollowUp` → `PatientFlow.tsx:115-121`, which re-navigates to the route the
user is already on.

---

### UX-13 · No role separation: a patient can open the doctor desk
**App / route / breakpoint:** Patient session → `/doctor`, `/doctor/case/:id`,
`/doctor/profile` · all breakpoints.

**What happens:** Signed in as the demo *patient*, navigating to `/doctor` renders the
full review desk — other patients' names, ages, blood groups, symptoms, histories, lab
results and draft prescriptions — with working Approve/Decline controls.
`/doctor/profile` renders the doctor profile stamped with the *patient's* identity ("Alex
Kumar · alex.kumar.demo@example.com" over "1,284 patients · 12 years · 4.8 rating"). The
patient's own Settings even advertises the route with a "Doctor view" menu row.

**What should happen:** Module access is gated by role; a patient hitting `/doctor` is
redirected to `/patient`. The "Doctor view" switcher belongs behind a demo/dev flag, not
in a patient's settings list.

**Likely responsible:** `apps/web/src/shell/routes.tsx:32-41` (no role guard on
`/doctor/*`) and
`apps/web/src/modules/patient/components/ProfileScreen.tsx:60` (`Doctor view` row).

---

## P2 — causes confusion or rework

### UX-14 · Home's "Your latest plan" card is a dead end
**App / route / breakpoint:** Patient `/patient` · all breakpoints.

**What happens:** After a consult, home shows a "Your latest plan" card with a status pill
and title. It is not clickable (no `onClick`, no role/tabindex — verified in the DOM), so
the one visible pointer to the patient's live case cannot be followed. Its status can also
be stale (see UX-01/UX-02): it read "PENDING REVIEW" after both an approve and a decline.

**What should happen:** The card opens the plan and reflects the current status.

**Likely responsible:** `apps/web/src/modules/patient/components/HomeScreen.tsx:104-114`.

---

### UX-15 · An abandoned consult leaves no trace and cannot be resumed
**App / route / breakpoint:** Patient, mid-consult · all breakpoints.

**What happens:** Start a consult, answer two questions, then reload the page (or close
the tab). The conversation is gone: the panel is closed, nothing is written to storage
(`liveQueue` length 0), and home shows no sign that a visit was ever started. The patient
must begin again from the greeting. Only in-app navigation preserves the session (the
panel does survive moving to Records — that part works).

**What should happen:** Per PRD §3A.5, an interrupted consult is recorded (resumable, or
auto-closed as "Visit ended early") and is visible in History. The app already has the
copy for this — `addConsultRecord({ title: 'Visit ended early' })` — but only the 30-minute
in-tab timer can reach it.

**Likely responsible:** consult state is component-local
(`apps/web/src/modules/patient/useConsult.ts:57-70`) and never persisted; the abandonment
timer at `apps/web/src/modules/patient/components/PatientFlow.tsx:96-111` only runs while
the tab and panel are open.

---

### UX-16 · The doctor's tab is not in the URL — reload and back reset it
**App / route / breakpoint:** Doctor `/doctor` · all breakpoints.

**What happens:** Home / Appointments / Reviews all live at `/doctor`. Selecting "Reviews"
does not change the URL; reloading returns to Home; the browser Back button does not undo
a tab change; "Reviews" cannot be bookmarked or linked. Leaving a case with the back
control also returns to whichever tab was last in state, not where the user came from.

**What should happen:** Each list is a route (e.g. `/doctor/reviews`) so refresh, back and
deep links behave.

**Likely responsible:** `apps/web/src/modules/doctor/DoctorApp.tsx:78`
(`const [tab, setTab] = useState<DeskTab>('home')`).

---

### UX-17 · A stale or wrong case URL silently shows a different patient
**App / route / breakpoint:** Doctor `/doctor/case/<unknown-id>` · 900 and 1400 wide.

**What happens:** Navigating to `/doctor/case/zzz` (a deleted, mistyped or another
hospital's id) renders the Home tab with **Maria Gonzalez's** case in the case pane, while
the address bar still says `/doctor/case/zzz`. No "case not found" is shown. On mobile the
same URL just shows the queue. A clinician following a stale notification link cannot tell
they are looking at the wrong case.

**What should happen:** An unresolvable case id shows an explicit "This case is no longer
available" state and corrects the URL.

**Likely responsible:** `apps/web/src/modules/doctor/DoctorApp.tsx:99-101` — unknown ids
fall back to `visible[0]` with no notice.

---

### UX-18 · A filtered-empty list claims the whole queue is empty
**App / route / breakpoint:** Doctor `/doctor`, Appointments tab + "Urgent" filter · 1400 wide.

**What happens:** With the Urgent filter on and no urgent cases, the queue header still
reads "APPOINTMENTS · 3", the list says "Nothing in this list", and the case pane shows
"No cases in the queue — New patient consults appear here automatically as they are
submitted" with a "Refresh" button. Three cases are in fact waiting; the offered action
(Refresh) cannot help, and the action that would (clear the filter) is not offered.

**What should happen:** "No urgent cases right now — [Show all]", with the count reflecting
the filter.

**Likely responsible:** `apps/web/src/modules/doctor/DoctorApp.tsx:145-152` — one
`emptyQueue` element is reused for "queue is empty" and "filter matched nothing".

---

### UX-19 · The queue filter exists only at desktop, only on one tab
**App / route / breakpoint:** Doctor `/doctor` · 390 and 900 wide.

**What happens:** The All/Pending/Urgent segmented control renders only when the
breakpoint is desktop *and* the Appointments tab is active (verified: 0 filter tabs at
900 wide). A doctor on a phone or tablet — explicitly a target context in PRD D-6 — has no
way to filter or sort the queue, and even on desktop the filter disappears when they
switch to Reviews.

**What should happen:** Filtering is available at every breakpoint (a compact control or
sheet on mobile) and on every list it applies to.

**Likely responsible:** `apps/web/src/modules/doctor/DoctorApp.tsx:176`.

---

### UX-20 · The mobile plan screen removes the entire navigation
**App / route / breakpoint:** Patient `/patient/recommendation` · 390 wide.

**What happens:** On mobile the plan screen renders with no bottom bar and no Mira orb
(verified: 0 nav items, 0 orb). The only way off the screen is the "Home" button in the
header; History, Labs, Profile and Mira are all unreachable from the screen the patient
sits on while waiting for review — and, per UX-03, returning to it later is impossible.

**What should happen:** The plan is a normal screen with the standard nav, or the reason
for hiding it (a focus mode) is made explicit and reversible.

**Likely responsible:** `apps/web/src/modules/patient/components/PatientFlow.tsx:147`
(`{(!mobile || screen !== 'recommendation') && <NavBar …>}`).

---

### UX-21 · The red button on the Mira panel looks like "end call" but only hides it
**App / route / breakpoint:** Patient and Doctor, Mira panel · all breakpoints.

**What happens:** The call dock's rightmost control is a red circular ✕ styled exactly like
a hang-up button; its accessible name is "Hide Dr. Mira" and it only hides the panel — the
session, the transcript and Mira's speech continue. There is no control anywhere that ends
or cancels a consult in progress, so a patient who wants to stop talking has no way to say
so; the consult simply lingers until the 30-minute timer (which itself requires the tab to
stay open — UX-15).

**What should happen:** Separate "minimize" (chevron/orb) from "end consult" (red), and
make ending explicit, confirmed and recorded.

**Likely responsible:** `apps/web/src/lib/ui/MiraPanel.tsx:400-405`.

---

### UX-22 · Dead affordances on the consult and plan screens
**App / route / breakpoint:** Patient, Mira panel and `/patient/recommendation` · all
breakpoints.

**What happens:**
- The camera button in the Mira dock toggles its own icon and does nothing else (the code
  comments say "Prototype only — nothing is captured yet"), while the PRD makes photo
  sharing part of the examination. A patient with a rash will tap it and wait.
- "Share with a caregiver" flips its label to "Shared" with a checkmark — no share sheet,
  no link, nothing sent (verified).
- "Saved to History" navigates to a History list that does not contain the plan (see
  UX-04).

**What should happen:** Remove or disable-with-explanation any control that does not
perform its stated action; a label must never assert something untrue ("Shared", "Saved").

**Likely responsible:** `apps/web/src/lib/ui/MiraPanel.tsx:391-399` (camera);
`apps/web/src/modules/patient/components/RecommendationScreen.tsx:160` (share);
`RecommendationScreen.tsx:162` (Saved to History).

---

### UX-23 · Offline banner and offline behaviour contradict each other
**App / route / breakpoint:** Patient `/patient` · all breakpoints.

**What happens:** Going offline shows "You're offline — consults and reviews need a
connection." Starting a consult anyway works completely: Mira greets, answers ("I'm sorry
you're running a fever…") and will produce a plan that is queued locally. The patient is
told they cannot consult, does it anyway, and is never told that the resulting plan has
not reached a doctor.

**What should happen:** Either block starting a consult while offline with a clear reason,
or allow it and label the resulting case "will be sent when you're back online".

**Likely responsible:** `apps/web/src/shell/AppShell.tsx:32-45` (banner) with no
corresponding gate in
`apps/web/src/modules/patient/components/PatientFlow.tsx:113-130`.

---

### UX-24 · Approving gives the doctor no confirmation and no next step
**App / route / breakpoint:** Doctor `/doctor/case/:id` · all breakpoints.

**What happens:** After "Approve & send" the only feedback is the status pill changing to
APPROVED and the pending count dropping (no toast, no `role="status"` region — verified
count 0). There is no undo, no "sent to Alex Kumar" confirmation, and no move to the next
case: the doctor stays on the case they just closed and must re-find the queue themselves.
For a queue worker this is the most repeated moment in the product.

**What should happen:** A brief confirmation of what was sent and to whom, a short undo
window, and an obvious "Next case" so the queue can be worked without navigating back.

**Likely responsible:** `apps/web/src/modules/doctor/DoctorApp.tsx:126-129` (`approveId`
performs the decision and nothing else).

---

### UX-25 · No first-run profile, and the health profile cannot be edited
**App / route / breakpoint:** Patient `/patient/profile` · all breakpoints.

**What happens:** Sign-in goes straight to the dashboard; no health-profile step is ever
shown, and age eligibility is a single toggle on the login screen with no DOB. On
`/patient/profile` the clinical facts Mira relies on — Age 34, Blood O+, Allergy
Penicillin — are static text with no edit control anywhere, while the plan screen tells
the patient "your Penicillin allergy was respected". A patient whose allergies changed
has no way to correct the record (PRD P-2 and UC-3.3 require it).

**What should happen:** A first-run profile step (DOB-based eligibility) and an editable
profile, with a note that changes apply to future consults.

**Likely responsible:** `apps/web/src/modules/patient/components/ProfileScreen.tsx:24-28`
(static `StatRow`); no wizard route exists in
`apps/web/src/modules/patient/components/PatientFlow.tsx:18-20`.

---

## P3 — polish

### UX-26 · Opening the Mira panel does not move focus into it
**App / route / breakpoint:** Patient and Doctor, Mira panel · all breakpoints.

**What happens:** After opening the panel, focus stays on the card that was clicked
(verified: `document.activeElement` is the "Start a consultation" card div). The container
has `role="dialog"` but no `aria-modal`, no initial focus and no focus containment, so a
keyboard or screen-reader user must tab through the page behind it to reach the composer.
Escape does close it, which is good.

**What should happen:** Move focus to the panel (composer or its heading) on open, restore
it to the orb on close.

**Likely responsible:** `apps/web/src/lib/ui/MiraPanel.tsx:234-245`.

---

### UX-27 · Unknown routes redirect silently
**App / route / breakpoint:** Both apps, e.g. `/patient/nonsense`, `/nope` · all breakpoints.

**What happens:** Any unknown path silently replaces itself with the patient home. A
mistyped or outdated link gives no indication that the destination did not exist.

**What should happen:** A brief "That page doesn't exist — here's your home" notice, or a
minimal not-found screen.

**Likely responsible:** `apps/web/src/shell/routes.tsx:39` and
`apps/web/src/modules/patient/components/PatientFlow.tsx:135-137`.

---

### UX-28 · Opening a case deselects every nav item
**App / route / breakpoint:** Doctor `/doctor/case/:id` · 900 and 1400 wide.

**What happens:** While a case is open, `active` is set to the empty string, so no rail
item is highlighted — the doctor loses the "you are here" cue for the whole time they are
doing the actual work, and returning is only possible by picking a tab (which also resets
the list, per UX-16).

**What should happen:** Keep the originating tab highlighted while its detail view is open.

**Likely responsible:** `apps/web/src/modules/doctor/DoctorApp.tsx:158`.

---

### UX-29 · No consult trace / audit view anywhere
**App / route / breakpoint:** Doctor, all routes · all breakpoints.

**What happens:** The case view shows the AI summary, "What the patient said" (a 3-bullet
digest) and the draft. There is no route or control anywhere that shows the actual consult
timeline — turns, timestamps, channel, queue entry, who opened it, the decision and the
draft-vs-final diff. PRD §5.4 makes this (O-1) an MVP-0 requirement, and the doctor's own
trust argument depends on it. The case view also shows the decision maker but no decision
timestamp.

**What should happen:** A per-case trace view reachable from the case, even if read-only.

**Likely responsible:** no implementation; nearest surface is
`apps/web/src/modules/doctor/components/CaseDetail.tsx:72-121`.

---

## Flows that could not be tested

- **Real voice turn-taking** (speech in, speech out, barge-in, end-of-speech detection):
  headless Chromium has no audio device — `speechSynthesis` never fires `end`, and
  `SpeechRecognition` never returns a result, so every consult here was completed by text.
  The voice-first path, mic-permission-denied UI and the "tap the wave to interrupt"
  behaviour remain unverified on a real device.
- **Google sign-in / real auth**: no Supabase keys are configured; the app runs in demo
  mode, so only the demo accounts were exercised.
- **A genuinely empty patient** (no history, no labs, no prescriptions): the store always
  mounts with seeds, so the true first-run empty states could only be read in code, not
  observed.
- **Push notifications and PWA install / offline shell**: not reachable from a headless
  browser session.
