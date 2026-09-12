# AI Doctor — Design Review

Reviewed at **Phone 430×932** and **Desktop 1440×900**, dark and light themes, both modules (patient: Alex Kumar; doctor: Dr. Sara Whitfield). Analysis only — no files were changed other than this one.

---

## 1. Overall verdict

This is a component library in search of a product. Every screen is the same recipe — a greeting, a stack of rounded cards, a coloured pill on each card — applied regardless of what the screen is for, so a triage queue that decides whether a patient gets a same-day nerve examination looks exactly like a list of vitamin D results. There is no information hierarchy: section labels are smaller than the card titles they govern, every card is the same width, weight and elevation, and the one thing that matters on each screen (start a consultation; the safety flags; the approve action) is routinely the smallest or lowest element on the page. Colour is decoration rather than meaning — amber means "needs a look", "routine", "pending", "closed" and "breached"; green means "in range", "routine", "safe" and "zero doses taken" — so a clinician cannot read state from colour, which is the entire point of colour in clinical software. The app does not model state: loading renders as a reassuring empty state that says "All results are within range" when four results are flagged, the home card claims a plan is APPROVED while the plan screen says PENDING REVIEW, and errors appear two at a time in two different visual languages and never clear. The desktop build is the phone build stretched: a three-up grid of phone cards with half the viewport empty, an icon-only rail collapsed by default on a 1400px canvas, and a case-review screen whose middle column — the clinical plan the doctor must read before signing — is the narrowest of the three. Worst of all, the governance story the product sells ("a licensed doctor reviews every plan") is not designed: Approve & send is a 130px pill placed above the content it approves, with the alternative to approval hidden behind an unlabeled 40px caret, and the doctor's own navigation drops them into the patient app with no way back. The copy is warm where it should be precise and vague where it should be directive ("Check", "Needs a look", "Tests and things to do"), which in clinical software is not a tone problem but a safety problem.

---

## 2. Findings, ordered by impact

### D1 — The doctor is dropped into the patient module and trapped there

- **What** — Clicking **Reviews** in the doctor's left rail renders the *patient* home for Dr. Sara Whitfield (patient nav: History/Labs/Profile; "Feeling unwell? Start a consultation"; "All results are within range."), and from that state every nav item, the browser Back button, and a hard reload all keep her in the patient module with no route back to the doctor console.
- **Where** — Doctor → Reviews (rail), desktop 1440 and phone 430; reproducible after a full page reload of `/` and `/doctor/reviews`.
- **Why it matters** — The reviewing clinician cannot reach the queue at all from the primary navigation; the only escape is sign out and sign in again. Six cases sit past their 2-hour target while the doctor looks at a patient dashboard bearing her own name telling her nothing needs attention.
- **Action** — **Make module selection a function of the authenticated role, not of a client flag: on session load, route `role === 'doctor'` to the doctor shell and never render the patient shell for a doctor account. Keep `Profile → Settings → Patient view` as an explicit, reversible mode: render it as a labelled switch row with an on/off control, and while it is on, pin a persistent 44px-tall banner across the top of every screen reading "Viewing as patient" with a "Back to doctor view" text button on the right. Fix the `Reviews` rail item to route to the queue. Add a route guard that, on any unknown/failed route, returns the user to their own module's home rather than falling through to the patient shell.**

### D2 — "Approve & send" is a small, unconfirmed, unbalanced action placed above the content it approves

- **What** — The act that converts an AI draft into a live prescription is a ~130px green pill sitting at the top of the case column (desktop) or in a floating bar (phone), reachable before the doctor has scrolled to the tests, the safety-netting advice, or the second safety flag; there is no confirmation, no signature step, no summary of what is being signed, and the only alternative to approving is an unlabeled 40px caret next to it.
- **Where** — Doctor → case detail (Omar Haddad), desktop 1440 and phone 430.
- **Why it matters** — Asymmetric affordances bias the reviewer toward approval. The product's entire safety claim is that a human signs off; the interface makes signing the path of least resistance and makes declining, editing, or requesting more information invisible.
- **Action** — **Move the decision bar to the bottom of the case column and make it sticky only after the doctor has scrolled past the last safety check. Present three peer actions in one row, left to right: `Request changes` (secondary, outlined), `Decline` (secondary, outlined, destructive text colour), `Approve & send` (primary, filled, minimum 180×48). Replace the caret menu entirely. On tapping Approve, open a confirmation sheet listing, in order: patient name + DOB/age, the exact items being prescribed with dose and duration, every unresolved safety flag, and a required checkbox "I have reviewed this plan and take clinical responsibility" that enables the final `Sign and send` button. Disable `Approve & send` while any safety check is unresolved, with helper text naming which one.**

### D3 — The same plan is APPROVED on one screen and PENDING on the next

- **What** — Patient home shows `APPROVED · 13 d ago · routine — Asthma preventer step-up`; opening that exact card shows `PENDING — A licensed doctor is reviewing Dr. Mira's plan. You'll be notified shortly.`
- **Where** — Patient → home card vs patient → plan detail, phone 430 and desktop 1440.
- **Why it matters** — The patient cannot tell whether to start the medicine. This is the single most consequential fact in the app and the app states it two ways within one tap.
- **Action** — **Derive both the home card badge and the plan header from one `plan.status` value; delete any local/optimistic status on the home card. Render one status component (`PlanStatusBadge`) with exactly four states — `Pending review` (amber), `Approved` (green), `Changes requested` (blue), `Declined` (grey) — used identically on the home card, the plan header, and History. Where status is `Pending review`, the plan detail must suppress dose instructions behind a "Not yet active — do not start these medicines" notice rather than showing the prescription card as if it were live.**

### D4 — The loading state is a reassuring empty state

- **What** — On first paint, patient home renders "No doses due.", "Nothing booked." and **"All results are within range."** for roughly a second before the real data (2 missed doses, an appointment, 4 flagged results) replaces it.
- **Where** — Patient → home, phone 430 and desktop 1440; also permanently visible in the broken doctor-in-patient-shell state (D1).
- **Why it matters** — The app makes a positive clinical assertion it has not verified. A patient who glances and locks the phone walks away believing their results are normal.
- **Action** — **Never render empty-state copy while `status === 'loading'`. Show skeleton blocks matching each card's final geometry (title line 60% width, subtitle line 40%, 16px radius, 1.2s shimmer). Reserve empty-state copy for confirmed-empty responses, and rewrite the results empty state from an assertion to a fact: "No results yet." Add a distinct error state per card ("Couldn't load results" + `Retry` text button) so a failed fetch is never silently rendered as good news.**

### D5 — Out-of-range lab values are drawn inside the normal range

- **What** — LDL cholesterol 132 mg/dL is plotted on a track labelled `0 … 100` with the marker sitting inside the track at ~88%; Total cholesterol 214 on a `0 … 200` track and Triglycerides 158 on a `0 … 150` track do the same. Every value, however high, renders as "nearly at the top but inside".
- **Where** — Patient → Labs → Lipid Profile, phone 430.
- **Why it matters** — The graphic contradicts the text beneath it ("Above the normal range"). Patients read the picture, not the caption.
- **Action** — **Scale each track to `max(referenceHigh × 1.5, value × 1.1)` so an out-of-range marker sits visibly beyond the reference band, and tint the track in three zones: below-low, normal (green), above-high (amber/red) with the reference band boundaries labelled at their actual positions rather than only at the track ends. When the value exceeds the plotted maximum, cap the marker at the right edge and render it as a filled triangle pointing right. Label the axis with the reference interval ("Normal 0–100") instead of the bare word "normal range".**

### D6 — Dr. Mira's side of the consultation is never written down

- **What** — The consult panel's "CONSULTATION NOTES" contains only the patient's own messages. The header says "Dr. Mira is speaking — tap the wave to interrupt", but nothing she says is ever transcribed, and after sending a message no reply, typing indicator, or assistant turn appears in the transcript.
- **Where** — Patient → Dr. Mira consult panel (orb), phone 430.
- **Why it matters** — The patient has no record of what the AI physician asked or advised, cannot re-read instructions, cannot screenshot them for a family member, and cannot use the product at all with sound off or hearing loss. A consultation with no record is not a consultation.
- **Action** — **Stream Dr. Mira's speech as left-aligned assistant bubbles in the same transcript, word-by-word in sync with the audio, with a subtle "speaking" pulse on the active bubble. Add a three-dot typing indicator while she is composing. Bottom-anchor the transcript (`justify-content: flex-end`) so the newest turn sits directly above the composer instead of leaving ~380px of dead space. Rename the section from "CONSULTATION NOTES" to "Transcript", and add a visible `Interrupt` button next to the waveform rather than relying on the undiscoverable "tap the wave" gesture.**

### D7 — Two different error components appear at once, contradict the header, and never clear

- **What** — After a failed send, a maroon bar "That didn't go through / Try again" sits mid-panel while a separate bordered card "Microphone is blocked / Try again / Keep typing" sits above it — two `Try again` buttons meaning different things — and the header simultaneously reads "Dr. Mira · Live". The maroon bar persists after a subsequent message sends successfully.
- **Where** — Patient → consult panel, phone 430. (Backend was returning 503s during review; the failure itself is fine, the presentation is not.)
- **Why it matters** — The patient cannot tell what failed, whether their symptom reached the doctor, or which button to press. In the doctor module the same class of failure produces *no* feedback at all — nav clicks silently do nothing.
- **Action** — **One inline error component, one per surface, placed immediately below the composer: icon + one sentence naming what failed + one action. Copy: "Your message didn't send." / `Resend`. Dismiss it automatically on the next successful send. Demote the microphone-permission notice to a single line inside the composer ("Mic blocked — typing works. Fix") rather than a card with two buttons. Make the status chip truthful: `Live` only while a session is connected, `Reconnecting…`, `Offline`. In the doctor module, add a global toast for failed navigation/data fetches ("Couldn't open the queue — Retry") — a dead click is never acceptable in a triage tool.**

### D8 — The day-3 check-in asks about a different condition than the plan

- **What** — Home shows the latest plan as "Asthma preventer step-up"; tapping `Answer` opens a check-in headed "How is it going with **seasonal allergic rhinitis**?"
- **Where** — Patient → home → check-in sheet, phone 430.
- **Why it matters** — The patient answers "Worse" about a condition they may not be being treated for, and that answer is flagged to the doctor as priority evidence.
- **Action** — **Bind the check-in title to the same `plan.condition` the home card renders, and show the plan title as a subtitle under the question so the patient can see which plan they are rating. If more than one plan is active, list them and require selection before the options appear.**

### D9 — The phone queue silently drops the safety-flag count

- **What** — On desktop, each queue row carries `2 safety flags`, `INVESTIGATION/PRESCRIPTION`, and `target passed 21h 56m ago`. On phone, those three fields are gone and replaced with a `PENDING REVIEW` pill that is identical on all six rows.
- **Where** — Doctor → Reviews queue, phone 430 vs desktop 1440.
- **Why it matters** — A doctor triaging on a phone between clinics cannot see which cases carry red flags — the only field that should determine what they open first — and the field that *is* shown carries zero information because every row has it.
- **Action** — **Make the phone row carry the same decision fields as desktop, in this order: patient name (17px semibold); plan title (15px); one urgency pill; safety-flag count as a red-tinted pill with a triangle icon when > 0 (omit entirely when 0); `waiting 23h 57m` right-aligned, red when past target. Delete the `PENDING REVIEW` pill from the queue — the queue is by definition pending. Drop the diagnosis line to a third line at 13px secondary, or remove it.**

### D10 — The patient's own account of their symptoms is collapsed by default

- **What** — On the case screen, `› What the patient said` is a closed disclosure, while the AI's `Assessment` is shown expanded and highlighted.
- **Where** — Doctor → case detail, desktop 1440 and phone 430.
- **Why it matters** — In a human-in-the-loop design the reviewer must be able to check the AI's conclusion against the source. Hiding the source and showing the conclusion trains the doctor to rubber-stamp.
- **Action** — **Expand the patient's account by default, place it above the AI assessment, and label it "What the patient reported". Collapse the AI's intermediate reasoning instead if space is needed. Keep the assessment visually secondary to the patient's words — same type size, no filled background.**

### D11 — On the appointments list, a status pill is shaped exactly like the two action buttons beside it

- **What** — Each appointment row ends with `Attended` (green outline), `No-show` (red outline), `BOOKED` (filled) — two irreversible actions and one read-only status rendered as three same-size pills in a row.
- **Where** — Doctor → Appointments, desktop 1440.
- **Why it matters** — A mis-tap marks a patient who attended as a no-show, which in most systems has billing and follow-up consequences. There is no undo.
- **Action** — **Separate status from action. Render the status as plain 12px uppercase text with a leading dot on the left of the row next to the time. Put the two actions behind a single `Mark…` button (min 44×44) that opens a menu with `Attended` / `Did not attend` / `Cancelled`. After the action, show an inline "Marked as no-show · Undo" for 8 seconds.**

### D12 — Green is used for zero

- **What** — The doctor's home tile reads `0 / Decided today / nothing signed yet` with the 0 in mint green; the patient's medicines header reads `0 of 2 doses so far` with the 0 in green, above a progress meter whose two filled segments actually represent *missed* doses.
- **Where** — Doctor → home, desktop 1440; Patient → Your medicines, phone 430.
- **Why it matters** — Green reads as "good". Nothing signed all shift and no doses taken are both the opposite. The meter and its label disagree about what is being counted.
- **Action** — **Reserve green for confirmed-good states only. Colour the "Decided today" value neutral when 0 and green only when ≥ 1; if 0 while cases are breached, colour it amber. On the medicines meter, fill segments for doses *taken* in green and render missed doses as hollow segments with a red outline, and change the label to "1 of 4 doses taken today · 2 missed" so the number and the meter count the same thing.**

### D13 — The queue claims a sort order it does not use, and every row is equally on fire

- **What** — The caption reads "urgency, then longest waiting"; the actual order is URGENT, ROUTINE, SOON, ROUTINE, SOON, SOON. All six rows carry `target passed 22–23h ago` in the same red, and a banner above them repeats the same fact a seventh time.
- **Where** — Doctor → Reviews queue, desktop 1440.
- **Why it matters** — The doctor cannot trust the order, so they must read all six rows every time. Uniform red means the one genuinely urgent case (motor weakness, 2 flags) does not stand out.
- **Action** — **Sort by (safety-flag count desc, urgency rank desc, wait desc) and make the caption match. Group the list under two headings — `Breached` and `Within target` — rather than colouring every row red. Give only the top row of `Breached` the red treatment; render the rest as neutral rows with the wait time in amber. Delete the banner: the section heading already carries the count.**

### D14 — The medicines screen offers no way to mark a dose as taken

- **What** — Missed doses offer `Took it late`; the dose due at 08:00 PM and every future dose have no action at all. The screen also warns "Kept on this device."
- **Where** — Patient → Your medicines, phone 430.
- **Why it matters** — The core daily job of a medication screen is to record a dose. The app supports only the retrospective apology. And it tells the patient their adherence record is not really stored, which undermines the "tell Dr. Mira" instruction in the same paragraph.
- **Action** — **Add a primary `Take` action to the next due dose (56×56 circular check button at the right of the row, filled once tapped, with the row collapsing to a taken state showing the actual time). Add `Skip` behind a long-press or a trailing overflow. Move the storage disclosure out of the header into Profile → About; if the record genuinely does not sync, say so plainly there and remove "she passes it on with your next plan" from the header, since that promise depends on syncing.**

### D15 — At 1440 the case screen gives the least width to the clinical plan and the columns collide

- **What** — The case view renders three columns: the queue list (~45% of width), the case detail (~13%, roughly 185px, wrapping "Assessment: Lumbar radiculopathy" over two lines), and safety checks (~25%). In the left column the urgency pills overlap the "waiting / target passed" text.
- **Where** — Doctor → case detail, desktop 1440.
- **Why it matters** — The doctor reads the plan they are signing in a column narrower than a phone, beside a list they have already finished with, next to visibly broken layout — which is what erodes trust in the software's judgement.
- **Action** — **Switch to a two-column master/detail at ≥1160px: queue list fixed at 360px on the left, case detail filling the remaining width with a 720px max measure, safety checks and patient history as a right-hand sidebar *inside* the detail column at 300px, or as cards stacked at the top of the detail when width < 1100px. Collapse the queue row to name + urgency dot + wait time when the detail is open. Fix the pill/wait-time overlap by giving the meta column `flex: 0 0 auto` and the title column `min-width: 0`.**

### D16 — "Patient view" is a settings row with no control, no state, and no way back

- **What** — Doctor → Profile → Settings lists `Patient view` as a plain row with a person icon and no switch, no chevron, and no description; the adjacent `Change password` row looks identically tappable but is inert ("Managed by your Google account"). `On duty · accepting reviews` is a static green pill, not a control.
- **Where** — Doctor → Profile, desktop 1440.
- **Why it matters** — The most consequential toggle in the doctor app is indistinguishable from an inert label, and the doctor cannot go off duty — the one setting a clinician actually needs.
- **Action** — **Give every settings row an explicit control: `Patient view` gets a switch with the subtitle "See the app as a patient does"; `On duty` becomes a switch with the subtitle "Accepting new reviews"; `Change password` becomes non-interactive body text under an "Account" caption, not a row. Rows without a control must not have hover/press states.**

### D17 — The app has no URLs, so nothing can be bookmarked, shared, or reached by Back

- **What** — Every screen in both modules is served at `http://localhost:3001` with no path change; the browser Back button does not return to the previous screen (it did not recover the doctor module from the patient shell).
- **Where** — Both modules, both viewports.
- **Why it matters** — A doctor cannot bookmark the queue, open two cases side by side, or send a colleague a link to a case; a patient cannot return to a plan from a notification. Back is the most-used control on the web and it does nothing.
- **Action** — **Adopt real routes — `/patient/home`, `/patient/plan/:id`, `/patient/labs/:panelId`, `/patient/medicines`, `/doctor/reviews`, `/doctor/reviews/:caseId`, `/doctor/appointments` — pushed to history on every navigation, restored on reload, and role-guarded per D1.**

### D18 — Navigation is inconsistent between modules, breakpoints, and screens

- **What** — Phone patient tab order is Home, History, Labs, Profile; the desktop rail order is **Profile**, Home, History, Labs. Phone doctor order is Home, Appointments, Reviews, Profile; desktop is **Profile**, Home, Appointments, **Reviews last**. The Labs tab opens a page titled **Records** containing a History/Labs segmented control, so History is reachable two ways. The plan and lab screens have a back pill; the medicines screen, reached the same way, has none. Doctor screens have no titles at all — every one is headed "Good evening, Sara".
- **Where** — Both modules, both viewports.
- **Why it matters** — Users build muscle memory from position. Moving Profile to the first slot on desktop guarantees mis-clicks, and burying Reviews last puts the doctor's only job at the bottom.
- **Action** — **One ordered nav model per role, identical at every breakpoint. Patient: Home, Records, Medicines, Profile. Doctor: Reviews, Appointments, Patients, Profile — Reviews first and default. Delete the Labs/History duplication: one `Records` destination with the History/Labs segmented control inside it, and no separate History tab. Give every screen its own title in the header (`Reviews`, `Appointments`, `Your medicines`) and move the greeting to the Home screen only. Every screen pushed on top of a tab gets the same back control in the same position.**

### D19 — Colour carries no consistent meaning

- **What** — Amber marks `Needs a look`, `ROUTINE` (history), `PENDING`, `CLOSED`, `SOON`, `PENDING REVIEW`, and the breach banner. Green marks `In range`, `ROUTINE` (queue), `APPROVED`, the safety reassurance card, `0 doses`, and `Attended`. Teal marks `WHEN TO SEEK HELP` — the most urgent block on the plan is the calmest colour on the screen. A single queue row can show five differently coloured pills.
- **Where** — Every screen, both viewports.
- **Why it matters** — When a colour means six things it means nothing, and clinicians and patients both read colour before text.
- **Action** — **Define five semantic roles and use nothing else: `critical` (red) = red flag, breach, missed dose, out-of-range; `warning` (amber) = needs attention, awaiting action; `positive` (green) = in range, approved, taken; `info` (blue) = neutral category (INVESTIGATION / PRESCRIPTION); `neutral` (grey) = closed, historic, informational. Re-map every existing badge to one of these. Cap badges at two per row. Recolour the "When to seek help" block to `critical` with a 3px left rule and a warning icon, and demote the green "Prepared against your health profile" card to `neutral` body text.**

### D20 — The type hierarchy is inverted and the layout is one section header per card

- **What** — Patient home has six section headings ("A quick check", "Medication", "Appointment", "Results", "Your latest plan", "Feeling unwell?") for six cards, and each heading is set smaller and lighter than the card title beneath it, so the label reads as subordinate to its own content. The all-caps micro-labels (`TODAY`, `TOMORROW`, `LDL CHOLESTEROL OVER TIME`) are flush to the screen edge while the cards they label are inset ~20px, and `LDL CHOLESTEROL OVER TIME` is visibly clipped at the left edge.
- **Where** — Patient → home, medicines, lab panel; phone 430 and desktop 1440.
- **Why it matters** — A heading per card adds a line of chrome without grouping anything, and misaligned labels make the page look untended.
- **Action** — **Drop section headings where a section holds one card; let the card's own title carry it (the Medication card already says "Beclometasone inhaler"). Where a heading is kept, set it at 13px/600/uppercase-tracking-0.04em in secondary colour, aligned to the card's left inset (same 20px gutter), with 24px above and 8px below. Card titles: 17px/600. Card body: 15px/400 at 1.45 line-height. Never let a section heading be visually lighter than its own content, and never let it sit outside the content gutter.**

### D21 — The orb is everywhere, unlabeled, and it covers content

- **What** — The gradient orb appears in the nav bar (overlapping the bar and the content behind it), at the top of the check-in sheet, at the top of the plan screen, in the consult panel, on the login screen, and in the *doctor's* rail. On phone it occludes the last card on home, the payment card on Profile, the "Collect medicine" step on the plan, and part of the queue list. It carries no visible label anywhere.
- **Where** — Both modules, phone 430 primarily; desktop rail too.
- **Why it matters** — An unlabeled floating blob is the app's most prominent interactive element and its purpose is learnable only by guessing. Content permanently hidden behind it is content that does not exist.
- **Action** — **Use the orb in exactly two places: the consult panel (where it represents the live session) and the nav entry point. Give the nav entry a visible label ("Dr. Mira") under the icon, matching the other tabs, and size it to the same 44px target rather than a raised 64px disc. Remove it from the doctor rail entirely — a reviewing clinician has no use for a patient consultation. Remove the decorative instances at the top of the check-in and plan screens and use that ~150px for content. Add `padding-bottom: calc(nav-height + 24px)` to every scroll container so nothing sits under the bar.**

### D22 — Desktop is the phone layout stretched, with most of the viewport empty

- **What** — Patient home at 1440 is a 3×2 grid of phone-width cards occupying the top 45% of the page, with each card still carrying its own floating micro-heading and the bottom ~55% blank. Doctor Appointments at 1440 shows one 48px row and ~95% empty canvas with no afternoon/evening structure. The left rail is collapsed to unlabeled icons by default on a 1400px window, with an expand chevron.
- **Where** — Patient → home; Doctor → Appointments, Profile; desktop 1440.
- **Why it matters** — The extra space is not used to reduce steps or show more context; it is used to space out phone cards. A clinician's console that shows one appointment per screen is a worse tool than a paper day-sheet.
- **Action** — **Design the desktop layouts separately. Patient home: a two-column layout — left column (flex 2) carries the check-in, the active plan with its full contents inline, and the medication schedule for today; right column (flex 1, 340px) carries results, appointments, and the consult entry as a full-height panel. Doctor Appointments: a day column showing MORNING / AFTERNOON / EVENING bands at fixed heights with empty slots drawn, plus a week strip at the top. Expand the rail with labels by default above 1160px and remember the user's collapse preference.**

### D23 — The light theme is a saturated lavender wash, not a light theme

- **What** — In light mode the entire page background is a heavy lavender (~#D9C9F5) with white cards on top; secondary text drops to low contrast against it, and the nav orb changes from purple to blue, so the brand mark is a different colour in each theme.
- **Where** — Both modules, all screens, phone 430 and desktop 1440.
- **Why it matters** — It looks like the dark gradient was inverted rather than a light palette designed. Outdoors on a phone, low-contrast secondary text on a mid-tone tint is unreadable, and clinical data must stay legible in a bright clinic.
- **Action** — **Rebuild the light palette on a near-neutral ground: page `#F6F5F8`, card `#FFFFFF`, hairline `#E6E4EC`, primary text `#14121C`, secondary text `#5B5766` (≥4.5:1 on card and on page). Keep the purple as an accent for interactive elements and the orb only — the orb must render the same gradient in both themes. Verify every badge colour pair at ≥4.5:1 in both themes.**

### D24 — The login screen has no states, no labels, and two different product names

- **What** — The demo account tiles are `div[role=button]` with no accessible name (a screen reader announces two unlabeled buttons); clicking one produces no pressed state, no spinner, and — when the backend is unavailable — no error at all. The page is headed "CityCare Hospital" while the browser tab title flips between "AI Doctor" and "CityCare Hospital". The three benefit lines and the entire card are centre-aligned in a 360px column on a 1400px canvas, and there are no terms/privacy links.
- **Where** — `/login`, phone 430 and desktop 1440.
- **Why it matters** — The first screen must establish that this is a real medical service. A dead click with no feedback, plus two different names for the product, does the opposite.
- **Action** — **Make the demo tiles real `<button>`s with `aria-label="Sign in as Alex Kumar, patient"`. Add press, loading (spinner replacing the label, tile disabled), and error states; on failure show an inline message under the card: "Couldn't sign in. Try again." Settle on one product name and use it in the `<title>`, the header, and the PWA manifest. Left-align the benefit list against the card's left edge. Add `Terms` and `Privacy` text links below the card, and a "Trouble signing in?" link.**

### D25 — The check-in says one tap and takes three, with a disabled button that looks enabled and a CTA that moves under your thumb

- **What** — The home card says "One tap tells your doctor how you are doing" and the sheet repeats "One tap is enough", but the flow is `Answer` → option → `Continue` = three taps. Before an option is selected, `Continue` still carries the full purple gradient (only the label greys out), so it reads as enabled. Selecting an option inserts an explanatory callout between the options and the button, pushing `Continue` down roughly 60px — my first tap on it missed.
- **Where** — Patient → home → check-in sheet, phone 430.
- **Why it matters** — Copy that promises one tap and delivers three is a small lie that costs trust; a button that looks enabled but is not is a defect; a CTA that moves after the tap that precedes it causes mis-taps on a screen where the options are "Better / About the same / Worse".
- **Action** — **Make selecting an option submit immediately (see CR-2) and delete `Continue`. If a confirmation step is kept, reserve the callout's vertical space from the start so the button never moves, and give the disabled state a flat `--surface-2` fill at 40% opacity with no gradient. Change the home card copy to "Answer one question" and the sheet subtitle to "Choose the one that fits."**

### D26 — Every row in a list gets the same icon

- **What** — Seven identical flask glyphs down the Labs list; the same flask on all thirteen "Tests and things to do" rows; the same droplet on every medicine row regardless of whether it is an inhaler, a tablet, or a capsule; the same pill glyph on all four prescriptions on Profile.
- **Where** — Patient → Labs, Profile, Your medicines; phone 430 and desktop 1440.
- **Why it matters** — A leading icon that never varies is 44px of horizontal space spent on nothing, and it pushes the text that does vary further right.
- **Action** — **Either differentiate (inhaler / tablet / injection / drops glyphs; blood / urine / imaging / functional-test glyphs) or delete the icon and reclaim the space for the value. In the Labs list, replace the flask with the actual headline result — "LDL 132 mg/dL" — so the list answers the question without a tap (see CR-4).**

### D27 — Answering the check-in does not clear it from home

- **What** — After answering "Worse" and continuing into a consultation, the home screen still shows the "A quick check / How is it going?" card with an `Answer` button.
- **Where** — Patient → home, phone 430.
- **Why it matters** — The patient cannot tell whether their answer was recorded, and may answer again, sending the doctor duplicate and possibly conflicting signals.
- **Action** — **On submit, replace the card in place with a confirmation state for the rest of the day — "Thanks — your doctor has been told you're feeling worse. Answered just now." with an `Undo` text button for 60 seconds — then remove the card. Invalidate the home query on submit so the state cannot diverge.**

### D28 — The patient Profile is a dumping ground with a life-critical fact styled as a statistic

- **What** — Profile carries, in one scroll: identity, three stat tiles (`AGE 34` / `BLOOD O+` / `ALLERGY Penicillin`), an orphaned `Edit health profile` pill, four prescriptions rendered differently from the medicines screen, thirteen "Tests and things to do" going back to 2024 with no grouping, and insurance and card details — the last partly hidden behind the floating orb. The penicillin allergy is given the same tile, same weight and the same 10px label as the patient's age.
- **Where** — Patient → Profile, phone 430 and desktop 1440.
- **Why it matters** — Allergy is the field that kills people. It should not share a component with "AGE". And "Tests and things to do" is a name a developer gives a bucket, not a name a patient understands.
- **Action** — **Pull allergies out of the tile row into a dedicated full-width `critical` banner directly under the name: warning icon, "Allergies: Penicillin", `Add or edit` on the right. Keep `Age` and `Blood group` as two tiles. Rename "Tests and things to do" to "Tests and follow-ups", group it under `Due now` / `Scheduled` / `Completed`, and default the completed group to collapsed. Move Prescriptions off Profile — it duplicates Your medicines with a different row design — and link to it instead. Move Coverage & payment behind its own row ("Insurance and payment ›"). Give `Edit health profile` a row of its own at the end of the identity block rather than floating under the tiles.**

### D29 — The doctor Profile shows vanity metrics and contradicts the app's own hospital name

- **What** — `PATIENTS 1,284` / `YEARS 12` / `RATING 4.8` (rating in green) sit above the practice details, which give the hospital as **Apollo Clinic · Koramangala** while every header in the app says **CityCare Hospital**. `Cases reviewed here: 0`.
- **Where** — Doctor → Profile, desktop 1440.
- **Why it matters** — A consumer-marketplace rating badge on a clinical console signals the wrong product. Two different employers for the same doctor signals the data is not real.
- **Action** — **Replace the three tiles with work metrics the doctor can act on: `Awaiting your review`, `Median decision time this week`, `Breached this week`. Delete the rating. Resolve the hospital name to one source and show it in both the header and the practice block. Move registration number and languages into a two-column definition list and keep the rest of the page for the settings from D16.**

### D30 — History entries are all identically badged, untruncated, and carry two affordances for one action

- **What** — Every consultation is badged `CLOSED` in amber; each card prints its full advice paragraph at body size, so three entries fill two and a half screens; the page subtitle says "tap to view details" while each card also has a `View details ⌄` control.
- **Where** — Patient → Records → History, phone 430.
- **Why it matters** — A badge on every row is noise; full-length body text makes the list unscannable; two affordances for one action makes the user guess which is real.
- **Action** — **Delete the `CLOSED` badge (a history list is closed by definition; badge only the exceptions, e.g. `Follow-up due`). Clamp the advice to two lines with `-webkit-line-clamp: 2`. Keep the whole card tappable, delete the `View details ⌄` control, and delete "tap to view details" from the subtitle. Add the condition and the resulting plan as a second line so the row is scannable: "Asthma preventer step-up · Beclometasone, Salbutamol".**

### D31 — Clinical text truncates mid-word in the triage list

- **What** — Desktop doctor home truncates rows to "Omar Haddad · Sciatica — same-day asses…" and "New motor weakness reported — clinician review sa…"; the medicines screen truncates "Twice daily, every …" on missed rows only, because the `Took it late` button steals the width, so the same string renders in full one row above.
- **Where** — Doctor → home "Needs you now"; Patient → Your medicines; phone 430 and desktop 1440.
- **Why it matters** — The truncated half of "clinician review same day" is the actionable half. And a dose instruction that truncates only when something has gone wrong is exactly backwards.
- **Action** — **Never truncate a clinical instruction or a safety reason. Allow two lines and wrap. On the medicines row, move the `Took it late` action to a second line beneath the text, or to a trailing 44px icon button, so the dose instruction always renders in full at a constant width.**

### D32 — Interactive elements have no accessible names and several targets are under 44px

- **What** — The six patient rows on the doctor home and the two demo-account tiles on login are buttons with no accessible name. The consult panel bottom bar puts speaker, mic and close as three unlabeled circular icons, plus a separate send arrow and an in-composer camera icon — five unlabeled affordances in one 200px band. Sign-out on the patient profile is an unlabeled icon sitting beside theme and notifications at identical size. The approve-menu caret is a 40px unlabeled circle.
- **Where** — Both modules, phone 430 and desktop 1440.
- **Why it matters** — This is a healthcare product; an unlabeled control is unusable with a screen reader, and an unlabeled destructive control (sign out, approve menu) next to identical benign ones invites mis-taps.
- **Action** — **Give every control an `aria-label` naming the target ("Open Omar Haddad's case, urgent, 2 safety flags"). Enforce a 44×44 minimum hit area on every icon button. Separate sign-out from the utility icon cluster: move it to a labelled row at the bottom of Profile, matching the desktop treatment which already shows the label. Label the consult-panel controls with visible 11px captions (Speaker / Mic / End) and remove the redundant camera icon from the composer if attachments are not supported.**

### D33 — Empty states are placeholders, not designs

- **What** — On the case screen, `PATIENT HISTORY — "Open the case to load this patient's record."` is shown *while the case is open*, and `PREVIOUS CONSULTATIONS` is a heading with nothing under it. On the lab panel, `No report file` renders as a full-width card that looks tappable but does nothing. The LDL chart draws a grey rectangle under a three-point line with no y-axis, no values and no units. The patient's case header reads "No demographics on file" as quiet grey metadata.
- **Where** — Doctor → case detail; Patient → lab panel; desktop 1440 and phone 430.
- **Why it matters** — These read as unfinished work, and one of them ("No demographics on file") is a prescribing hazard presented as a footnote.
- **Action** — **Every empty state gets: one line saying what is absent, one line saying why or what to do, and an action where one exists. Patient history: load it with the case, or say "No previous consultations at this clinic." Report file: "No report file attached" as 13px secondary text, not a card. Chart: remove the grey block, add a y-axis with the reference band shaded, label each point with its value, and show the unit once. Promote "No demographics on file" to a `warning` row inside Safety checks with an `Add demographics` action, and block approval on it.**

### D34 — Copy is soft where it must be directive, and technical where it must be plain

- **What** — `Needs a look` (who looks? by when?); `Check` as a button label next to RED FLAG (a verb or a past participle?); `MEDIUM` with no noun; `Tests and things to do`; `Results from your previous blood work & tests` heading a list containing lung function and urine tests; `Kept on this device`; `Feeling unwell?` as the heading above the primary consultation CTA; the doctor console opening with "Good evening, Sara" instead of the work.
- **Where** — Throughout, both modules.
- **Why it matters** — Clinical software is read under time pressure. Ambiguous labels get skipped, and a skipped red flag is the failure mode the whole product exists to prevent.
- **Action** — **Rewrite to name the actor and the action: `Needs a look` → `Out of range`; the safety-check button `Check` → `Acknowledge` (and show `Acknowledged by Dr. Whitfield · 14:02` after); `MEDIUM` → `Confidence: Medium` with a tooltip defining the scale; `Tests and things to do` → `Tests and follow-ups`; the Labs subtitle → `Results from your tests`; `Feeling unwell?` → delete the heading and let the button read `Talk to Dr. Mira`. Replace the doctor greeting with the screen name plus the one number that matters: `Reviews — 6 waiting, 1 urgent`.**

---

## 3. Click / tap reduction

The client's priority. Each entry: task, current steps, target, action.

**CR-1 — Patient starts a consultation from home**
Current: 4 (scroll past six cards → tap "Start a consultation" — or tap the unlabeled orb, which is undiscoverable). Target: **1**.
**Action — Put the consult entry above the fold as the first element under the greeting on phone, and as a full-height right-hand panel on desktop, with the button reading `Talk to Dr. Mira`. Label the nav orb "Dr. Mira" so the second entry point is discoverable rather than guessed. Do not require a scroll to reach the product's primary action.**

**CR-2 — Patient completes the day-3 check-in**
Current: 3 (Answer → option → Continue), against copy promising one. Target: **1** (2 for "Worse", which warrants a confirmation).
**Action — Put the three options directly on the home card as three tappable rows; tapping one submits immediately and swaps the card to the confirmation state from D27. Reserve the sheet for the "Worse" path, where it should open straight into the consult with the answer pre-filled.**

**CR-3 — Patient acts on a flagged result from home**
Current: 5 (home → "4 results need a look" → Records/Labs list → find the flagged row among seven, sorted by date → panel; repeat the last two steps for each of the other three). Target: **2** to the first flagged panel, **1** to move between them.
**Action — Make the home Results card open a filtered list containing only the flagged panels. Add `Next flagged result ›` at the bottom of each lab panel so the remaining three are one tap each. Default the Labs list to a `Needs attention` segment with `All` beside it.**

**CR-4 — Patient checks a specific value (e.g. "is my LDL still high?")**
Current: 3 (Records → Labs → Lipid Profile) and the list gives no values at all. Target: **0–1**.
**Action — Show the headline abnormal value and its direction on the list row itself ("LDL 132 mg/dL ↑ from 141") in place of the identical flask icon, so the common question is answered without entering the panel.**

**CR-5 — Patient records that they took a dose**
Current: impossible for a due dose; 3 to apologise for a missed one (home → medication card → `Took it late`). Target: **1**.
**Action — Per D14, add a `Take` button on the due dose row, and surface the next due dose with that same button directly on the home Medication card so the daily action is one tap from launch.**

**CR-6 — Doctor opens the review queue after sign-in**
Current: 2 in the best case (`Open the queue`), and **infinite** via the rail, which drops the doctor into the patient app with no route back (D1). Target: **0**.
**Action — Make Reviews the doctor's default landing screen and the first rail item. The home dashboard's five KPI tiles are a summary of a list the doctor must open anyway; fold them into a single header line above the queue itself.**

**CR-7 — Doctor decides a case and moves to the next**
Current: 4 per case (queue row → read → Approve & send → back to queue), ×6 = 24 interactions to clear the queue, with no keyboard path. Target: **2 per case**.
**Action — After a decision, auto-advance to the next case in sort order and show a "Approved — Omar Haddad · Undo" toast for 8 seconds instead of returning to the list. Add keyboard shortcuts on the case screen: `J`/`K` next/previous, `A` approve (opens the confirmation sheet), `R` request changes, `Esc` back to queue, with a `?` shortcut sheet.**

**CR-8 — Doctor reads the patient's own account**
Current: 2 (open case → expand "What the patient said"). Target: **1**.
**Action — Expand it by default per D10.**

**CR-9 — Doctor marks an appointment outcome**
Current: 1, but on two same-shaped pills beside a same-shaped status pill, with no undo — the wrong kind of one tap. Target: **2 with an undo**.
**Action — Per D11: one `Mark…` button → menu → inline undo. Trading one deliberate extra tap for reversibility is the correct exchange here.**

**CR-10 — Doctor returns to the doctor module after Patient view**
Current: sign out and sign back in (≈5 interactions, and only if the user works out that is the fix). Target: **1**.
**Action — Per D1 and D16: a persistent "Viewing as patient — Back to doctor view" banner.**

**CR-11 — Patient reaches their medicine schedule**
Current: 2 from home, but **unreachable from the tab bar** — Medicines has no tab, so from any other screen it is Home → card. Target: **1 from anywhere**.
**Action — Per D18, give Medicines a tab of its own in the patient bar, replacing the duplicated History tab.**

---

## 4. Keep list

These are genuinely good and a redesign must not lose them.

1. **The plain-English clinical rationale under every prescribed item** — "Regular reliever use means the preventer is not holding, not that you need more reliever", "Pain relief could mask a worsening deficit". This is the best writing in the product: it explains the *reasoning*, not just the instruction. Extend this voice; do not flatten it into generic patient-information text.
2. **"When to seek help" as a standing block on every plan** — explicit safety-netting with concrete thresholds ("if you cannot speak a full sentence", "numbness between the legs or bladder trouble") is exactly right and is what a good clinician writes down. Keep the content verbatim; only fix its colour and prominence (D19).
3. **The wait-time and target-breach model in the doctor queue** — `waiting 23h 57m` / `target passed 21h 56m ago` is the right pair of numbers to run a review service on. The presentation needs work (D13), but the underlying idea — an explicit SLA visible on every row — should survive.
4. **Safety checks as a first-class, separate panel on the case screen** — red flags and allergy-class checks pulled out of the plan body into their own region is the correct structure for human-in-the-loop review. Keep the panel; fix the ambiguous `Check` button and the undifferentiated severity.
5. **"What happens next" on the plan** — a four-step progress model (Consult complete → Doctor review → Plan ready → Collect medicine) is the right mental model for a patient waiting on an approval. Move it above the CTAs, but keep it.
6. **The typography of the large screen titles** — "Good evening, Alex", "Your medicines", "Records" are well-set, confident, and correctly weighted. That treatment should become the standard screen title on every screen, including the doctor's (D18).
