# Virtual Doctor — Design Notes

## Project structure
- `Patient.dc.html` — Patient-facing app (iPhone frame via `ios-frame.jsx`)
- `Doctor.dc.html` — Doctor-facing app (iPad-style desk window, `DeskWindow`)
- `Assistant.dc.html` — Shared AI assistant/consult component (formerly "AiBot"), imported via `<dc-import name="Assistant">` into both Patient and Doctor apps; also works standalone
- `ios-frame.jsx` — iPhone device bezel starter component
- `image-slot.js` — drag-and-drop image placeholder component

## Naming conventions
- All structural div labels use `data-om-label="PascalCase"` (e.g. `ConsultScreen`, `ReviewNotesPanel`, `SuggestionChipsRow`, `NotesAndSuggestions`, `MessageInputRow`, `StatusPill`, `MicToggleButton`, `DeskWindow`, `AppsCanvas`).
- `data-screen-label` is used (not `data-om-label`) specifically to label full screens/slides for comment-anchoring context, e.g. `data-screen-label="Patient · Consult"`.
- `data-name` attributes were removed everywhere per request.
- Removed unnecessary nesting of wrapper divs/rows/columns across all three files to flatten the DOM hierarchy.
- The orb visualization uses SVG instead of CSS-drawn circles/gradients.

## Assistant.dc.html (consult AI component)
- Renamed from "AiBot" to "Assistant" throughout.
- Two render modes: `mode="patient"` (voice consult with Dr. Mira) and `mode="review"`/doctor review mode (with consult notes thread).
- `embedded` prop: true when mounted inside Patient/Doctor apps (bare screen, no phone chrome); false for standalone preview (adds its own phone-style frame).
- Removed the "Tap the orb to talk" status pill entirely (both embedded & standalone).
- Removed "App title stack" per request (also manually removed from Doctor app; redundant top-level wrapper div was then removed from Doctor.dc.html).
- Call controls bar (`CallControlsWrapper`/`CallControlsBar`) redesigned to a video-call-style pill bar matching the app's lavender theme: `MuteButton` (mic mute/unmute), `VideoToggleButton` (camera on/off), `AudioRouteButton` (speaker/route cycling), `EndCallButton`. Upload folded into the text input row (`MessageInputRow` with `AttachButton`).
- Chat bubbles styled like iMessage chat bubbles, themed to the app palette:
  - Bubble font-size: 10px.
  - Speaker label + relative timestamp ("3 seconds ago", "1 minute ago", etc.) shown below each bubble.
  - "Mine"/patient-side bubble background: `oklch(0.93 0.025 300)` (light lavender), text color `#3A2E5C`.
  - Other-side bubble: white background, same text color.
- Suggestion chips (auto-suggestions):
  - Reduced to exactly 3 chips (patient mode: "I have a fever", "Bad headache", "Stomach pain").
  - Styled to match chat bubble shape (`border-radius:16px 16px 4px 16px`), light lavender background `oklch(0.93 0.025 300)`, border `oklch(0.85 0.04 300)`, font-size 10px, weight 400, color `#3A2E5C`.
  - Left-aligned (`justify-content:flex-start`), not centered.
- Layout order (top to bottom): title/orb section (fixed size, `flex:none`) → `NotesAndSuggestions` wrapper (`flex:1`, contains `ReviewNotesPanel` + `SuggestionChipsRow`, expands/scrolls to fill space) → `MessageInputRow` → `CallControlsWrapper` (call controls bar), anchored at bottom.
- Removed the standalone "Tap the orb to talk" `StatusPill`; "Dr. Mira" title now sits alone above the orb.
- `ConsultScreen` (both embedded and standalone) uses `height:100%; width:100%; box-sizing:border-box` so it fills its parent container completely.
- Review/doctor mode: Dr. Mira's opening summary line is short and spoken-style, e.g. "Hey doctor, looks like this case is about [assessment]. I ordered [tests/meds]." — not a full repeat of the consultation.
- Patient-mode seeded reply bubble: "Thank you, here is my problem." attributed to "Patient" (not "You").
- Doctor/review screen's original "Dr. Whitfield" content is preserved unchanged where applicable.

## Doctor.dc.html
- Top-level redundant wrapper div removed after "Title stack" removal — `DeskWindow` is now a direct child of `AppsCanvas`.
- Desk window height matched to iPad height (834px).
- Key labeled regions: `TopBar` (profile/notification buttons, `NotificationsPanel`, `DoctorProfilePanel`), `QueueCaseRow` (`ReviewQueueList` + `CaseDetail`), `CaseDetail` containing `CaseHeader` (`CaseIdentityGroup`, `CaseStatusGroup`), `CaseDetailBody` with `AssessmentHistory` (`AiAssessmentCard`, `ConsultationSummary`, `ObservationBox`, `EvaluationBox`, `NextStepsBox`/`NextStepsGrid`, `AdviceBox`, `ApprovedBanner`) and side cards `PatientHistoryCard`, `TestHistoryCard`.

## Patient.dc.html
- `Assistant` dc-import uses `position:absolute; inset:0; width:100%; height:100%` (previously had a stray `left:2px; top:308px` offset causing it to render only in the top half — fixed).

## Known editor quirk
- Direct-edit (drag/resize) changes made in the live preview apply as overrides stored outside the file source (not in these files). If an element (e.g. `ReviewNotesPanel`, orb section, a chat bubble) appears cropped/mis-sized despite the template being correct, it likely has a leftover manual size override — clear/reset it via the editor on that specific element.
