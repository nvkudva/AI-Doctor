# Virtual Doctor — QA sweep findings

Functional / UI / a11y / console sweep of the running app, complementing the
flow-level audit in `docs/UX-FINDINGS.md`. Findings already recorded there
(UX-01…UX-29) are **not** repeated; the ones re-confirmed during this sweep are
listed in "Previously-reported findings re-confirmed" at the bottom.

**How this was produced:** Playwright (Chromium) against `http://localhost:3003`
at 390×844, 900×1000 and 1400×1000, in both themes, as both demo roles.
`pageerror` and `console.error` were captured on every route. Every entry below
was observed in the running app; `file:line` points at the code most likely
responsible.

**Severity:** P1 = broken or data-losing · P2 = wrong but workable · P3 = polish.

**Standard prelude (assumed by every entry unless stated otherwise):**
`/login` → click "I confirm I am 18 or older" → click "Fake patient" or
"Fake doctor". Theme is set with `localStorage.vd_theme = 'light' | 'dark'`
followed by a reload.

---

## P1 — broken or data-losing

### QA-01 · Approving any case files that patient's prescription into the *local* patient's records
**Category:** functional · **App/route:** Doctor `/doctor/case/c1` → Patient `/patient/records?tab=history` · all breakpoints, both themes.

**Steps**
1. Sign in as **Fake doctor**. Go to `/doctor/case/c1` (Maria Gonzalez, "Persistent dry cough").
2. Click "Approve & send".
3. Read `localStorage.vd_state_v1`.
4. Go to `/doctor/profile` → "Sign out". Sign in as **Fake patient** (Alex Kumar).
5. Go to `/patient/records?tab=history`.

**Observed** — step 3 writes
`consultsAdd: [{ id: "live-…", title: "Chest X-ray + trial of antihistamine", status: "Approved", note: "Return sooner if fever, breathlessness or coughing blood appears.", user: true }]`.
The `user: true` flag means "belongs to the signed-in demo patient", so at step 5
Alex Kumar's Consultation history shows **Maria Gonzalez's plan** as his own
approved consult ("Chest X-ray + trial of antihistamine · APPROVED · Today ·
Dr. Mira"), above his real seeded rows. Approving a `prescription`-type case does
the same thing to `rxAdd`, adding another patient's drug to Alex's medication list.

**Expected** — a review decision writes a record for the *case's* patient. A
record must never be filed against a different patient, and never against the
locally signed-in demo account just because it is the only patient the store
knows about.

**Likely responsible:** `apps/web/src/store/ClinicProvider.tsx:77-83` — `decide()`
unconditionally pushes `{ …, user: true }` into `prescriptions` and `consults`
for *any* approved case; it never checks `c.mine`.

---

### QA-02 · Sign-out leaves the previous user's clinical data on the device
**Category:** functional · **App/route:** any · all breakpoints, both themes.

**Steps**
1. Sign in as **Fake doctor**, approve `/doctor/case/c1` (this seeds `consultsAdd`, see QA-01).
2. `/doctor/profile` → "Sign out". You land on `/login`.
3. Read `localStorage.vd_state_v1` while signed out.
4. Sign in as **Fake patient**.

**Observed** — step 3 still contains the full `{ liveQueue, consultsAdd, rxAdd }`
snapshot, including consult transcripts, symptom lists, patient demographics and
prescriptions. Step 4 renders all of it as the newly signed-in user's own data.
The same applies in the other direction: run a patient consult, sign out, sign in
as the doctor, and the previous patient's live cases are still in the queue.

**Expected** — signing out clears the local clinical snapshot (or scopes it per
account). On a shared device this is a straightforward disclosure of one
patient's record to the next person who signs in.

**Likely responsible:** `apps/web/src/shell/auth.tsx:150-154` — `signOut()` calls
`persist(null)` (which clears only `vd_auth`) and never touches `vd_state_v1`.
`apps/web/src/lib/api/storage.ts:6` owns that key and exposes no clear function.

---

### QA-03 · The Mira orb sits on top of "Approve & send" and swallows taps on it
**Category:** ui · **App/route:** Doctor `/doctor/case/:id` · **390×844 only** · both themes.

**Steps**
1. Sign in as **Fake doctor** at 390×844. Go to `/doctor/case/c1`.
2. Tap "Approve & send" roughly 70 % of the way across it (about 25 px right of centre).

**Observed** — the Dr. Mira FAB orb from the bottom nav overlaps the top-right of
the fixed decision dock. `document.elementFromPoint()` sampled across the
button's mid-line returns:

| point across button | element hit |
| --- | --- |
| 15 % / 35 % / 50 % | `BUTTON "Approve & send"` |
| **70 %** | **`Dr. Mira` (nav orb)** |
| 90 % | `BUTTON "Approve & send"` |

So a tap in that band opens the Dr. Mira panel instead of approving the case, and
the orb visually covers part of the button label. Measured geometry at 390×844:
approve dock `top 718 / bottom 754`, orb `top 736 / bottom 798`.

**Expected** — the primary clinical action is fully visible and fully hit-testable.
Either the decision dock clears the nav dock vertically, or it sits above it in
the z-order.

**Likely responsible:** `apps/web/src/modules/doctor/components/CaseDetail.module.css:80-93`
— `.dock` is `position: fixed; z-index: 6; bottom: calc(78px + env(safe-area-inset-bottom))`,
while `apps/web/src/lib/ui/NavBar.module.css:108-113` gives the nav dock
`z-index: 40` and `apps/web/src/lib/ui/NavBar.module.css:131-134` pulls the FAB
`top: -30px` out of it. 78 px of clearance is not enough for a FAB that
overhangs its bar by 30 px.

---

## P2 — wrong but workable

### QA-04 · React "style property during rerender" error — mixed `animation` shorthand and `animationDelay`
**Category:** console · **App/route:** any route with the nav orb · all breakpoints, both themes.

**Steps**
1. Sign in as either role. Open the Dr. Mira panel from the nav orb.
2. Watch the console.

**Observed** — one `console.error` per voice-state transition:

> Updating a style property during rerender (animation) when a conflicting property is set (animationDelay) can lead to styling bugs. To avoid this, don't mix shorthand and non-shorthand properties for the same value; instead, replace the shorthand with separate values.

Opening the panel fires it once; a full six-turn typed consult fired it **11
times**. It is the only console error the app produces on any route.

**Cause (precise)** — `VoiceAura` renders the orb's rings with an inline style
object that contains both the `animation` shorthand and the `animationDelay`
longhand. `animation` interpolates `dur`, which changes whenever `voiceState`
changes (`idle` → `listening` → `speaking`), so React re-writes the shorthand on
a node that also carries the longhand.

**Expected** — no console error; split the shorthand into `animationName`,
`animationDuration`, `animationTimingFunction` and `animationIterationCount`
longhands (or move the whole thing into `NavBar.module.css` and drive it with
custom properties, which is what the CSS-Modules refactor did everywhere else).

**Likely responsible:** `apps/web/src/lib/ui/NavBar.tsx:155-161` — the `style`
object inside `VoiceAura`'s `.map()`; `animation` on :159, `animationDelay` on :160.

---

### QA-05 · Dismissed notifications come back on every reload
**Category:** functional · **App/route:** Doctor `/doctor` (and Patient `/patient`) · all breakpoints, both themes.

**Steps**
1. Sign in as **Fake doctor**. The bell shows a badge of `1`.
2. Open the bell, dismiss "New AI case awaiting review" with its × (or tap the notice, which also dismisses it).
3. The list correctly reads "All caught up — no new notifications."
4. Reload the page.

**Observed** — the badge is back at `1` and the notice has returned. The same is
true for SLA notices raised by `slaTick`. There is no way to permanently clear a
notification.

**Expected** — a dismissed notification stays dismissed across reloads.

**Likely responsible:** `apps/web/src/store/ClinicProvider.tsx:32-34` — `notices`
is seeded from a literal in `useState` and is the only piece of store state with
no matching `persistLocal` effect (compare :39-47). `LocalSnapshot`
(`apps/web/src/lib/api/storage.ts:9-14`) has no `notices` field.

---

### QA-06 · The bottom sheet says `aria-modal` but does not trap focus or take focus
**Category:** a11y · **App/route:** any route with a Sheet (notifications on mobile, the decline sheet) · **390×844** · both themes.

**Steps**
1. Sign in as **Fake doctor** at 390×844 on `/doctor`.
2. Click the bell — the notifications sheet opens over a scrim.
3. Press Tab repeatedly.

**Observed** — focus is still on the bell button when the sheet opens (nothing
inside it is focused). Six Tabs walk: notice row → its Dismiss × → and then
**straight out of the dialog**, onto the "Maria Gonzalez" queue card, the
"James Okoro" card and "See all appointments" — all of which are behind the
scrim and unreachable by mouse. Focus never returns to the sheet and Shift-Tab
does not wrap. The same applies to the decline sheet: opening it leaves
`document.activeElement === document.body`.

**Expected** — a `role="dialog" aria-modal="true"` surface moves focus to itself
(or its first control) on open, cycles Tab within itself, and restores focus to
the trigger on close.

**Likely responsible:** `apps/web/src/lib/ui/Sheet.tsx:20-35` — the dialog `div`
declares `role="dialog" aria-modal="true"` but has no `autoFocus`, no `ref`
focus call, no `onKeyDown` Tab handling and no `inert`/`aria-hidden` on the
background. `useDismiss` (`apps/web/src/lib/ui/Dismiss.tsx`) handles Escape and
outside-click only.

---

### QA-07 · The Dr. Mira panel does not trap focus either
**Category:** a11y · **App/route:** Patient `/patient` and Doctor `/doctor` · all breakpoints, both themes.

**Steps**
1. Sign in as **Fake patient** at 390×844 (or any width). Open the Dr. Mira panel.
2. Click into the "Type your message instead…" field and press Tab 22 times.

**Observed** — focus leaves the panel after five stops and traverses the entire
page behind it before wrapping:

`Send message → Silence Dr. Mira → Turn microphone off → Turn camera on → Hide Dr. Mira → **Switch to dark mode → Notifications → Cetirizine card → Lipid Profile card → Start a consultation card → Home → History → Labs → Profile → Dr. Mira** → Interrupt Dr. Mira → chips → composer`

A keyboard user mid-consult can silently focus and activate "Start a
consultation" or a nav item without ever seeing focus leave the conversation.
The panel is `role="dialog"` but carries no `aria-modal`, so assistive tech is
not told the rest of the page is inert either.

Note: Escape **does** close the panel correctly (verified), and reopening it
preserves the transcript (verified). UX-26 already covers the missing
*initial* focus; the missing trap and missing `aria-modal` are additional.

**Expected** — while the panel is open, Tab cycles within it and the background
is `inert`.

**Likely responsible:** `apps/web/src/lib/ui/MiraPanel.tsx:188` —
`<div role="dialog" aria-label="Dr. Mira" className={s.frame}>` with no
`aria-modal`, no focus management, and no background inerting.

---

### QA-08 · Nothing in the app has a hover state
**Category:** ui · **App/route:** every route · **900×1000 and 1400×1000** (mouse widths) · both themes.

**Steps**
1. Sign in at 1400×1000. Hover the "History" rail item, then any `Button`, then a
   `MenuRow` in the notifications popover or the decision menu, then a suggestion
   chip in the Mira panel, then a record card.

**Observed** — no visual change on any of them. Measured on the rail item:
`getComputedStyle(el).backgroundColor` is `rgba(0, 0, 0, 0)` both before and
during hover. Grepping the whole CSS-Modules layer confirms it: there is
**exactly one** `:hover` rule in the app
(`apps/web/src/modules/doctor/components/QueueCard.module.css:12-13`) and none at
all in `NavBar.module.css`, `Button.module.css`, `Card.module.css`,
`Sheet.module.css`, `Chip.module.css` or `MiraPanel.module.css`. Pressed feedback
survives (a single global `[role="button"]:active, button:active { transform: scale(0.97) }`
at `apps/web/src/lib/theme/theme.css:340`) and `:focus-visible` survives
(`theme.css:284-288`, verified rendering a 2 px `rgb(123,77,224)` outline) — only
hover was lost. This reads as a regression from the inline-styles → CSS-Modules
move: pointer affordance is now absent on both desktop breakpoints.

**Expected** — every interactive surface (nav item, button, menu row, chip, tab,
clickable card, icon button, orb) has a hover treatment, ideally behind
`@media (hover: hover)` so it does not stick on touch.

**Likely responsible:** the CSS-Modules files listed above; `NavBar.module.css`
(`.item`, `.tab`, `.orbRow`, `.collapse`), `Button.module.css` (`.skinPrimary`,
`.skinSecondary`, `.skinTertiary`, `.skinDanger`), `Sheet.module.css:73-88`
(`.row`), `Card.module.css` (`.clickable`).

---

### QA-09 · "Approve & send" is a 36 px target on mobile
**Category:** a11y · **App/route:** Doctor `/doctor/case/:id` · **390×844** · both themes.

**Steps** — sign in as **Fake doctor** at 390×844, open `/doctor/case/c1`, measure
the primary button.

**Observed** — `120 × 36 px`. It is the only sub-44 px control on any mobile
screen, and it is the doctor module's primary clinical action. (Its sibling
"More decision actions" chevron measures 48 × 36 at desktop widths and is also
short.)

**Expected** — ≥ 44 × 44 on touch widths (DESIGN's own tap-target rule; the nav
tabs, dock buttons and menu rows all honour it).

**Likely responsible:** `apps/web/src/lib/ui/Button.module.css:30` —
`.sizeApprove { … height: 36px; padding: 0 14px; }`, applied unconditionally by
`variant="approve"` at `apps/web/src/modules/doctor/components/CaseDetail.tsx:37`
and `:104` with no mobile override.

---

### QA-10 · Mira's suggestion chips are 27 px tall and the last one is cut off the screen
**Category:** ui + a11y · **App/route:** Patient `/patient`, Doctor `/doctor` (Mira panel) · **390×844** · both themes.

**Steps**
1. At 390×844, sign in as **Fake patient** and open the Dr. Mira panel.
2. Look at the chip row above the composer.

**Observed** — four chips, each `≈100 × 27 px`. The fourth ("Feeling better")
starts at x = 350 and ends at x = 454 on a 390 px viewport, i.e. it is
two-thirds off-screen. The row *is* horizontally scrollable (`overflow-x: auto`),
but `composes: vd-scroll` hides the scrollbar
(`apps/web/src/lib/theme/theme.css:278`), there is no fade or peek treatment, and
the chip's cut edge reads as clipping rather than as "scroll for more". Identical
on the doctor side ("Add a test" clipped at x = 396→477).

**Expected** — chips are ≥ 44 px tall on touch, and the row either wraps or
carries a visible affordance that it scrolls.

**Likely responsible:** `apps/web/src/lib/ui/MiraPanel.module.css:174-192` —
`.pills { overflow-x: auto }` with `composes: vd-scroll`, and
`.pill { padding: 5px 11px }` with no `min-height`. Rendered at
`apps/web/src/lib/ui/MiraPanel.tsx:261-270`.

---

### QA-11 · The 18+ gate error is never announced
**Category:** a11y · **App/route:** `/login` · all breakpoints, both themes.

**Steps**
1. Load `/login`. Do **not** toggle the age switch.
2. Click "Fake patient" (or "Continue with Google").

**Observed** — "This service is for adults (18+). Please confirm to continue."
appears above the Google button, but the element has `role = null`,
`aria-live = null` and `tabIndex = -1`, and focus is not moved to it. A screen
reader user hears nothing at all: the click appears to do nothing and the page
does not navigate. There is also no programmatic association between the message
and the `role="switch"` it refers to.

**Expected** — `role="alert"` (or `aria-live="assertive"`) on the error, and
`aria-describedby` / `aria-invalid` wiring from the switch, so the rejection is
announced.

**Likely responsible:** `apps/web/src/modules/login/LoginPage.tsx:84` —
`{(err || authErr) && <div className={s.error}>{err || authErr}</div>}`.

---

### QA-12 · Clickable cards are buttons with run-on accessible names
**Category:** a11y · **App/route:** Patient `/patient`, `/patient/records`; Doctor queue · all breakpoints, both themes.

**Steps**
1. Sign in as **Fake patient** at 1400×1000 on `/patient`.
2. Inspect the three focusable cards.

**Observed** — each is `<div role="button" tabIndex=0>` with **no `aria-label`**,
so its accessible name is the concatenated text content with no separators:
`"Cetirizine 10mgOnce daily, 14 daysTonight, 8:00 pm"`,
`"Lipid ProfileBorderline · Feb 2, 2026Needs review"`,
`"Start a consultationTalk to Dr. Mira — no forms, just talk"`.
Screen readers read the run-on string as one label, and there is no indication
of what activating the card will do. (Compare the nav items, which use
`pressProps` and get a clean one-word label.)

**Expected** — either an explicit `aria-label` describing the action
("Open Cetirizine 10 mg prescription"), or a real heading/structure inside a
card that is not itself a button.

**Likely responsible:** `apps/web/src/lib/ui/Card.tsx:26-31` — `Card` adds
`role="button" tabIndex={0}` whenever `onClick` is present but never accepts or
requires a label. Call sites:
`apps/web/src/modules/patient/components/HomeScreen.tsx:103` and `:128`.

---

## P3 — polish

### QA-13 · The case audit line prints the raw enum: "rejected by Dr. Whitfield"
**Category:** ux · **App/route:** Doctor `/doctor/case/:id` · all breakpoints, both themes.

**Steps**
1. Sign in as **Fake doctor**. Open `/doctor/case/c1` → "More decision actions" → "Decline…" → "Don't approve".
2. Read the line under "Advice:".
3. Repeat on `/doctor/case/c2` with "Send back for changes".

**Observed** — `rejected by Dr. Whitfield` and `changes by Dr. Whitfield` —
lowercase, ungrammatical, and leaking the internal decision enum. The approved
branch is correctly cased ("Approved by Dr. Whitfield") because it is the only
one that is special-cased.

**Expected** — "Declined by Dr. Whitfield" / "Sent back for changes by
Dr. Whitfield", from the same label table the status pills already use
(`statusPill` in `apps/web/src/lib/theme/index.ts:16-30` has "Declined" and
"Changes" ready to go).

**Likely responsible:** `apps/web/src/modules/doctor/components/CaseDetail.tsx:91`
— `{ac.decision === 'approved' ? 'Approved' : ac.decision} by {ac.reviewedBy}`.

---

### QA-14 · At tablet width the login brand orb is clipped by the left edge
**Category:** ui · **App/route:** `/login` · **900×1000 only** · both themes.

**Steps** — load `/login` at 900×1000 in either theme.

**Observed** — the `MiraPresence` glow overflows the viewport: its `.fluid` layer
measures `left: -38px` and its `.ring` layer `left: -1px`, so the orb's halo is
sliced flat against the window edge. `document.scrollWidth` is unchanged (the
overflow is clipped, not scrollable), so the only symptom is a visibly cut orb.
It renders correctly at 390 and at 1400.

**Expected** — the brand column's left padding accommodates the orb's glow at
the tablet grid, or the orb shrinks with the column.

**Likely responsible:** `apps/web/src/modules/login/LoginPage.module.css:26`
(`.wrap` switches to `grid-template-columns: minmax(0, 1fr) 440px` at ≥ 800) and
`:36` (`.brand` flips to `align-items: flex-start` at ≥ 800) — at 900 the free
column is only ~330 px wide while `MiraPresence` is still rendered at `size=152`
(`LoginPage.tsx:47`) plus its glow.

---

### QA-15 · Sub-44 px icon controls at desktop
**Category:** a11y · **App/route:** every route · **1400×1000** (and 900 for the header pair) · both themes.

**Steps** — sign in at 1400×1000 and measure the chrome controls.

**Observed** — "Collapse navigation" is **32 × 32**; "Switch to dark/light mode"
and "Notifications" are **40 × 40**. All three are icon-only, so there is no text
to enlarge the hit area. The collapse chevron in particular is the smallest
target in the app and sits flush in the rail's top corner.

**Expected** — ≥ 44 × 44, or a transparent padded hit area around the visual disc.

**Likely responsible:** `apps/web/src/lib/ui/NavBar.module.css:24-38` (`.collapse`)
and `apps/web/src/lib/ui/Button.module.css:33` (`.iconOnly { min-width: 48px }`
sets width but never a matching height; the 40 px comes from the caller's
`size` prop via `--icon-btn-size` at `apps/web/src/lib/ui/Button.tsx:101`).

---

### QA-16 · An unknown `?tab=` value silently renders History and stays in the URL
**Category:** ux · **App/route:** Patient `/patient/records?tab=bogus` · all breakpoints, both themes.

**Steps** — sign in as **Fake patient**, navigate to `/patient/records?tab=bogus`.

**Observed** — the History tab's content renders, but the URL keeps
`?tab=bogus`, so the address bar and the visible tab disagree and the state is
not shareable or restorable. (Valid values `?tab=history` and `?tab=labs` both
work, and switching tabs correctly pushes history entries — browser Back from
History returns to Labs.)

**Expected** — an unrecognised `tab` value is normalised out of the URL
(`replace` to `/patient/records`) or coerced to the default value in the URL.

**Likely responsible:** `apps/web/src/modules/patient/components/RecordsScreen.tsx`
— the `tab` search-param read has no allow-list validation and no `replace`
normalisation.

---

### QA-17 · Six navigation stops before any content, and no skip link
**Category:** a11y · **App/route:** every signed-in route · **900×1000 and 1400×1000** · both themes.

**Steps** — sign in as **Fake patient** at 1400×1000 on `/patient`, press Tab from
a fresh load.

**Observed** — the tab order is
`Collapse navigation → Profile → Home → History → Labs → Dr. Mira → Switch to dark mode → Notifications → <first card>`.
Six chrome stops precede the page's own content on **every** route, with no
"Skip to content" link and no landmark shortcut, so a keyboard user re-traverses
the whole rail on each navigation. The rail is also ordered
`Profile, Home, History, Labs` (profile first, because it is the `railTop` item),
which does not match the visual reading order a sighted user expects from the
mobile bar (`Home, History, Labs, Profile`).

**Expected** — a skip link as the first tab stop, and/or `<main>` landmark
targeting so the nav can be jumped.

**Likely responsible:** `apps/web/src/shell/AppShell.tsx:29-43` (no skip link,
and the content slot is a plain `div`, not `<main>`) and
`apps/web/src/lib/ui/NavBar.tsx:76-84` (the collapse button is rendered before
the items, making it the first stop).

---

## Previously-reported findings re-confirmed

These reproduced during this sweep and are **already documented** in
`docs/UX-FINDINGS.md`; no new entry was written for them.

- **UX-01** — one typed consult still produces two `pending_review` cases
  (`live-1788637466734` and `live-1788637467137`, 403 ms apart; the earlier one
  captured only 5 of the 6 `stated` turns).
- **UX-02** — approve / decline / send-back on `/doctor/case/c1` are gone after a
  reload; `vd_state_v1.liveQueue` stays `[]` throughout.
- **UX-03** — reloading `/patient/recommendation` right after a consult shows
  "No plan to show yet".
- **UX-13** — signed in as the patient, `/doctor` renders the full desk (greeting
  reads "Good morning, Alex").
- **UX-17** — `/doctor/case/zzz` renders the desk with a different patient's case
  instead of a not-found state.
- **UX-26** — opening the Mira panel leaves focus on the nav orb.
- **UX-27** — `/patient/nope` silently redirects to `/patient`.

---

## Suspected, not reproduced

- **Horizontal chip row on a real touch device.** QA-10 establishes the chip row
  is `overflow-x: auto` with a hidden scrollbar; a synthetic Playwright drag was
  not attempted, so whether the clipped chip is *reachable* by touch drag (as
  opposed to merely clipped) is unverified.
- **Decline with a manually emptied reason.** The decline sheet's textarea has an
  `aria-label` but no visible label and no placeholder, and "Don't approve" is
  never disabled. In practice the reason is pre-filled, so declining without
  selecting a chip still produces a sensible reason — but
  `apps/web/src/modules/doctor/components/CaseDetail.tsx:104` gates the patient-facing
  "Not approved:" block on `ac.rejectReason` being truthy, so a doctor who clears
  the textarea would ship a decline with no reason shown anywhere. Clearing the
  textarea by hand was not tested.
- **Voice paths.** As in the UX audit, headless Chromium has no audio device, so
  `SpeechRecognition`, barge-in, the mic-denied UI and the aura's `listening`
  state were only reached through the typed path.

---

## Build health

`bun run typecheck` and `bun run build` both pass unchanged (`tsc --noEmit` clean;
Vite build succeeded in 644 ms, PWA precache 10 entries / 407.92 KiB).

## Coverage

Swept in both themes at 390×844, 900×1000 and 1400×1000: `/login`, `/patient`,
`/patient/records`, `/patient/profile`, `/patient/recommendation`, `/doctor`,
`/doctor/case/c1`, `/doctor/case/c2`, `/doctor/profile`, plus reload on every
route, browser back/forward across the records tabs, the full typed consult flow,
approve / decline / send-back, theme toggle, nav-rail collapse (persists correctly
across reload — no bug), panel hide-and-reopen (transcript preserved — no bug),
and notification dismissal.
