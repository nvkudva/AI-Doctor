# Design implementation checklist

Derived from `docs/DESIGN.md`. P1 = broken or inconsistent, must fix · P2 = responsive gaps · P3 = polish. All paths relative to repo root.

## Foundation (shared)

- [x] P1 · apps/web/src/lib/theme/theme.css · Add the missing semantic token pairs to both `:root` and `[data-theme="dark"]` — `--vd-lab-ok-bg/fg`, `--vd-lab-warn-bg/fg`, `--vd-rx-bg/fg`, `--vd-inv-bg/fg`, `--vd-advice-bg/fg`, `--vd-safety-bg/fg`, `--vd-assessment-bg/bd` — using the exact values in DESIGN.md §2.2.
- [x] P1 · apps/web/src/lib/theme/theme.css · Fix the contrast failures by changing light `--vd-ink-3` → `#4a5a72`, `--vd-ink-soft` → `#585379`, `--vd-ink-4` → `#67628a`, `--vd-nav-active` → `oklch(0.46 0.19 290)`, dark `--vd-ink-4` → `#928bbd`, and adding `--vd-nav-idle` (`#585379` / `#9b94c7`).
- [x] P1 · apps/web/src/lib/theme/theme.css · Rename `--vd-accent-ink` to `--vd-ink-on-glass` and add `--vd-ink-on-approve`, `--vd-surface-raised`, `--vd-border-strong`, `--vd-scrim`, `--vd-focus`, `--vd-selected-ring`, `--vd-glass-solid`, `--vd-urgent-glow` in both themes.
- [x] P1 · apps/web/src/lib/theme/theme.css · Add the metric and motion scales: `--vd-space-1…10`, `--vd-radius-xs|sm|md|lg|xl|2xl|pill`, `--vd-elev-0…5`, `--vd-dur-1…5`, `--vd-ease-spring|out|in|overshoot` per DESIGN.md §4–§6.
- [x] P1 · apps/web/src/lib/theme/theme.css · Add `.vd-glass`, `.vd-glass-thin`, `.vd-glass-thick` implementing the §8.1 recipe, plus the `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` and `@media (prefers-reduced-transparency: reduce)` fallbacks to `--vd-glass-solid`.
- [x] P1 · apps/web/src/lib/theme/theme.css · Add a global `button, input, textarea, select { font: inherit }` reset and `:focus-visible { outline-color: var(--vd-focus); border-radius: inherit }`.
- [x] P1 · apps/web/src/lib/theme/index.ts · Replace the `type` map with the DESIGN.md §3 scale: add `display` and `subhead`, add `lineHeight` and `letterSpacing` to every role, and expose per-breakpoint size variants (mobile / tablet / desktop).
- [x] P1 · apps/web/src/lib/theme/index.ts · Replace `radius` with the §4.2 values, replace `shadows` with `elevation = {0..5}` aliasing `--vd-elev-*`, and add `space` and `motion` exports.
- [x] P1 · apps/web/src/lib/theme/index.ts · Replace `control = {btn:48, icon:44, compact:38}` with per-breakpoint metrics (btn 48/50/52, icon 44/44/40, chip 44/40/40, input 48/50/52) per §7.
- [x] P1 · apps/web/src/lib/theme/index.ts · Re-order `z` to `sticky 6, header 10, nav 40, sheet 50, catcher 55, popover 60, toast 70` so modals always outrank the bottom nav.
- [x] P1 · apps/web/src/lib/theme/index.ts · Make `statusPill` the single label source (delete the duplicate map in `Primitives.labelOf`) and add `urgent` and `soon` rows.
- [x] P1 · apps/web/src/shell/viewport.ts · Change the mobile query to `(max-width: 799.98px)` — 800 px currently matches both `useIsMobile()` and `media.tabletUp` — and add `useBreakpoint(): 'mobile'|'tablet'|'desktop'`.
- [x] P1 · apps/web/src/lib/theme/index.ts · Add `media.desktopUp = '@media (min-width:1160px)'` and `media.mobileOnly` so modules stop hand-writing queries.
- [x] P1 · apps/web/src/lib/ui/Primitives.tsx · Replace the `▶` glyph in `Disclosure` with `<Icon name="chevD">` rotated, and give `MicroLabel` built-in `margin: 16px 0 8px` plus `--vd-ink-3` (it fails contrast at `--vd-ink-4`).
- [x] P1 · apps/web/src/lib/ui/Button.tsx · Create `<Button variant="primary|secondary|tertiary|danger|approve">` implementing §7 metrics and export it from `lib/ui/index.ts`.
- [x] P1 · apps/web/src/lib/ui/Chip.tsx · Create the single `<Chip selected onSelect>` (h 44 mobile / 40 tablet+, pill, `--vd-border-strong`, selected `--vd-surface-mine`) and export it.
- [x] P1 · apps/web/src/lib/ui/Card.tsx · Create `<Card>` and `<EmptyState icon title body action>` per DESIGN.md §11.2 / §11.6 and export them.
- [x] P1 · apps/web/src/lib/ui/Sheet.tsx · Create `<Sheet>` and `<Popover>` (scrim + glass-thick backdrop, grab handle, Escape/outside dismiss, bottom-anchored on mobile, centred ≥800; popover `--vd-elev-5`, rows min-h 44, `z.popover`) and export them.
- [x] P2 · apps/web/src/lib/ui/AppHeader.tsx · Create the shared `<AppHeader title subtitle actions>` (largeTitle, 44 circular glass actions, `AccountMenu` last, sticky glass-thin at ≥800) used by both modules.
- [x] P2 · apps/web/src/lib/ui/SideNav.tsx · Create the rail/sidebar nav — 76 px icon rail at tablet, 248 px labelled sidebar at desktop, sticky, glass, items from an array — per DESIGN.md §10.1.
- [x] P2 · apps/web/src/lib/ui/AccountMenu.tsx · Enlarge the avatar trigger from 38×38 to 44×44, swap the `☾`/`☀` glyphs for `Icon` entries, and replace the hardcoded shadow and radius with `--vd-elev-5` / `--vd-radius-lg`.
- [x] P2 · apps/web/src/lib/ui/Mira.tsx · Add `minimized` and `onMinimize`/`onMaximize` props so `MiraPresence` renders the floating glass puck itself (PRD MC-4) instead of each module wrapping it.
- [x] P3 · apps/web/src/lib/ui/Mira.tsx · Drive the ring and sphere animation durations from `--vd-dur-*` / `--vd-ease-*` instead of the literal `1.4s` / `2.8s`.

## Patient module

- [x] P1 · apps/web/src/modules/patient/ConsultView.tsx · Delete the header mic button — mute lives only in the call dock; two controls toggle the same state today.
- [x] P1 · apps/web/src/modules/patient/ConsultView.tsx · Replace every colour literal (`oklch(0.85 0.04 300)` chip border at 1.17 contrast, `rgba(90,70,180,.28)`, `oklch(0.6 0.1 290/.16|.2)`, `rgba(180,30,60,.5)`) with tokens.
- [x] P1 · apps/web/src/modules/patient/ConsultView.tsx · Rebuild the suggestion chips on `<Chip>` and the end-visit confirmation on `<Sheet>` — the sheet has neither a scrim nor outside-tap dismiss today.
- [x] P1 · apps/web/src/modules/patient/ConsultView.tsx · Enlarge the 38×38 back and mic buttons to 44×44.
- [x] P1 · apps/web/src/modules/patient/components/RecommendationScreen.tsx · Replace the nine `oklch()` literals (kind chip, urgency chip, advice callout, safety callout, timeline dots, avatar ring `#7A5AE0`) with `--vd-rx-*`, `--vd-inv-*`, `--vd-advice-*`, `--vd-safety-*` and status tokens — six measure 1.54–1.93 in dark.
- [x] P1 · apps/web/src/modules/patient/components/RecommendationScreen.tsx · Enlarge the 38 px "Home" back chip to 44 and rebuild `actionBtn` / `actionGhost` on `<Button>`.
- [x] P1 · apps/web/src/modules/patient/components/RecordsScreen.tsx · Replace the four `oklch()` literals in `LabRow` with `--vd-lab-ok-*` / `--vd-lab-warn-*` (1.78 and 1.66 in dark), change the segmented-control indicator to `--vd-surface-raised` (invisible against the panel in dark), and replace every fractional font size with `type.footnote` / `type.callout`.
- [x] P1 · apps/web/src/modules/patient/BottomNav.tsx · Switch inactive labels to `--vd-nav-idle` and active labels to the corrected `--vd-nav-active` (2.26 and 3.70 today).
- [x] P2 · apps/web/src/modules/patient/BottomNav.tsx · Render only below 800 px.
- [x] P2 · apps/web/src/modules/patient/components/PatientFlow.tsx · Mount `<SideNav>` at ≥800 with the four tabs plus the consult action (which replaces the FAB), and keep `<BottomNav>` below it.
- [x] P2 · apps/web/src/modules/patient/PatientApp.tsx · Replace the `min(560px,100%)` / `min(1120px,100%)` shell with the §10 containers: 100 % on mobile, 860–1000 at tablet, 1180–1360 at desktop with a 248 px sidebar column.
- [x] P2 · apps/web/src/modules/patient/components/HomeScreen.tsx · At ≥800 vertically centre the hero (`min-height: calc(100dvh - 160px)`), grow the orb to 168 / 184, and move `AccountMenu` into `<SideNav>`; render the greeting through `<AppHeader>` below 800.
- [x] P2 · apps/web/src/modules/patient/ConsultView.tsx · Centre the whole tablet/desktop grid instead of capping `.vd-consult-main` at 760 inside a `1fr` track (the stage hugs the left edge at 1440); at ≥800 drop the transcript's `maxHeight: 40dvh`, grow the orb to 128 / 160, and anchor the call dock directly beneath the composer.
- [x] P2 · apps/web/src/modules/patient/components/RecommendationScreen.tsx · Replace `display:contents` on `.vd-plan-split` with a real `minmax(0,1fr) 300px` grid and move the doctor card and "What happens next" into the right rail at ≥800.
- [x] P2 · apps/web/src/modules/patient/components/RecommendationScreen.tsx · Make the action row a sticky glass bottom bar (h 72) inside the main column at ≥1160.
- [x] P2 · apps/web/src/modules/patient/components/RecordsScreen.tsx · Cap the segmented control at 420 px and left-align it at ≥800; grid history cards 2-up at ≥1160, labs/documents 2-up at tablet and 3-up at desktop; add `alignItems:'stretch'` to the Coverage & payment row so the two cards match height.
- [x] P2 · apps/web/src/modules/patient/components/EmptyRecommendation.tsx · Rebuild on `<EmptyState>`.
- [x] P3 · apps/web/src/modules/patient/components/HomeScreen.tsx · Add a third aside card at desktop showing the latest plan status so the right rail is not two cards in a 900 px column.
- [x] P3 · apps/web/src/modules/patient/ConsultView.tsx · Move the "Consultation notes" grab handle and label into a `<Card>` header and drop the ad-hoc `color-mix` background.
- [x] P3 · apps/web/src/modules/patient/components/RecordsScreen.tsx · Replace the "View details ›" / "Show less ‹" text chevrons with the `Icon` set.

## Doctor module

- [x] P1 · apps/web/src/modules/doctor/components/CaseDetail.tsx · Replace every non-token colour — the three `oklch()` tints (assessment block, test-history pills at 1.57 / 1.66 in dark), both `color-mix(... , transparent)` card fills, and `rgba(6,35,26,.25)` — with `--vd-assessment-*`, `--vd-lab-*` and `--vd-surface-card`.
- [x] P1 · apps/web/src/modules/doctor/components/CaseDetail.tsx · Rebuild `approveBtn` on `<Button variant="approve">` with `--vd-ink-on-approve`, move the decision menu from `z.toast` onto `<Popover>` at `z.popover`, and delete the orphaned `flex:'8 1 240px'` wrapper and its `flexWrap` (the second column was removed; one child remains).
- [x] P1 · apps/web/src/modules/doctor/components/CaseDetail.tsx · Raise every `12` / `12.5 px` reading size to `type.callout` / `type.footnote` so the doctor module reads at the same size as the patient module.
- [x] P1 · apps/web/src/modules/doctor/components/QueueCard.tsx · Replace the `color-mix(... 60%, transparent)` fill with `--vd-surface-card`, the two shadow literals with `--vd-elev-2` / `--vd-elev-3`, the `oklch(0.6 0.2 290/.7)` ring with `--vd-selected-ring`, and the two inline urgency `<span>`s with `<StatusPill status="urgent|soon">`; give the card `min-height: 96`.
- [x] P1 · apps/web/src/modules/doctor/components/MiraFloat.tsx · Rebuild the panel as `<MiraPresence audience="doctor">` with the review controls passed as a slot (PRD MC-1 / MC-3) — it is currently a second, forked voice UI.
- [x] P1 · apps/web/src/modules/doctor/components/MiraFloat.tsx · Delete every hardcoded colour (`rgba(28,24,55,.85|.9|.78)`, the seven `rgba(255,255,255,…)`, `#3A2E5C`, `#241B45`) — the panel is dark-navy in light mode and ignores the theme entirely — and rebuild the quick-command chips on `<Chip>` and the three raw `<button>`s on `<Button>`.
- [x] P1 · apps/web/src/modules/doctor/components/DeclineSheet.tsx · Rebuild on `<Sheet>`; replace `rgba(23,19,51,.45)` with `--vd-scrim` and `sheetSecondary` / `sheetDanger` with `<Button>`.
- [x] P1 · apps/web/src/modules/doctor/DoctorApp.tsx · Render the empty-queue state inside the normal layout with `<DeskHeader>` still mounted — it currently replaces the entire page, stranding the user with no navigation or account menu.
- [x] P1 · apps/web/src/modules/doctor/components/DeskHeader.tsx · Replace `oklch(0.62 0.21 20)` (notification badge) and `rgba(90,70,170,.22)` with tokens.
- [x] P2 · apps/web/src/modules/doctor/DoctorApp.tsx · Render the shared bottom nav below 800 px (Queue · Alerts · Mira FAB · Approved · Account) — the doctor module has no mobile navigation at all today.
- [x] P2 · apps/web/src/modules/doctor/DoctorApp.tsx · Split the layout three ways — 1 pane on mobile, queue 320 + detail at tablet, queue 340 + case 760 + patient panel 340 at desktop, `max-width: 1560`, 40 px gutters — and move patient history and test history into that third pane (PRD D-3); content currently spans the full 1440 uncapped with the panels stacked in the main column.
- [x] P2 · apps/web/src/modules/doctor/DoctorApp.tsx · Mount the minimised Mira orb at app-shell level rather than inside the `Desk` route so it survives navigation (PRD MC-5).
- [x] P2 · apps/web/src/modules/doctor/components/DeskHeader.tsx · Rebuild on `<AppHeader>`: sticky glass-thin, h 64 / 72 / 76, with the pending count as a pill beside the title on mobile instead of a subtitle line.
- [x] P2 · apps/web/src/modules/doctor/components/CaseDetail.tsx · On mobile move "Approve & send" and the overflow chevron out of the sticky top header into a sticky glass bottom action bar (h 72, safe-area padded, above the bottom nav).
- [x] P2 · apps/web/src/modules/doctor/components/CaseDetail.tsx · Cap the content column at 760 px / 68 ch at ≥1160; the AI summary runs ~90 characters per line at 1440 today.
- [x] P2 · apps/web/src/modules/doctor/components/MiraFloat.tsx · Suppress the floating orb below 800 px (the bottom-nav FAB replaces it) and offset it to `right/bottom: 24–28` at ≥800; it overlaps case content at every size today.
- [x] P2 · apps/web/src/modules/doctor/components/DeskHeader.tsx · Give the notification popover a fixed 360 px width with `max-height: 60vh` at ≥800 and a full-width bottom sheet below it, replacing the current `position: fixed|absolute` swap.
- [x] P3 · apps/web/src/modules/doctor/components/QueueCard.tsx · Add a `pointer: fine` hover state (`--vd-elev-3` plus a 1 px `--vd-selected-ring` at 30 % alpha).
- [x] P3 · apps/web/src/modules/doctor/components/QueueCard.tsx · Apply `--vd-urgent-glow` to cards whose `rec.urgency === 'urgent'` so urgency reads without parsing the pill.
- [x] P3 · apps/web/src/modules/doctor/DoctorApp.tsx · Add an All / Pending / Urgent segmented filter to the header at ≥1160 (PRD D-2).

## Login & shell

- [x] P1 · apps/web/src/modules/login/LoginPage.tsx · Remove `flex:1` from the `width:min(560px,100%)` container and use `width:min(420px,100%); margin:auto` — the card currently stretches to the full viewport, giving 1400 px-wide buttons at 1440.
- [x] P1 · apps/web/src/modules/login/LoginPage.tsx · Replace `rgba(255,255,255,.55)`, `rgba(36,27,69,.25|.2|.12)` and `rgba(46,37,71,.25|.18)` with `--vd-surface-card`, `--vd-border-strong`, `--vd-border` and `--vd-elev-2/3` (the adult-gate toggle and demo cards have no dark-mode values), rebuild the Google button and demo cards on `<Button>` / `<Card>`, and raise the adult-gate row to h 56.
- [x] P1 · apps/web/src/shell/AppShell.tsx · Replace the update toast's `#241B45` background and `rgba(12,20,60,.4)` shadow with `--vd-surface-card` / `--vd-elev-5`, and position it above the active chrome — `bottom: calc(88px + env(safe-area-inset-bottom))` on mobile, `bottom: 24` at ≥800 — instead of a fixed `bottom: 100`.
- [x] P2 · apps/web/src/modules/login/LoginPage.tsx · Add the two-column split at ≥800: brand column (orb 152 / 184, `display` name, reassurance copy) left, 420 / 440 sign-in card right, container 900 / 1080.
- [x] P2 · apps/web/src/shell/App.tsx · Give `LoadingSkeleton` the module background and centre it in the container; it renders on a bare gradient for 2–3 s while auth resolves.
- [x] P2 · apps/web/src/shell/auth.tsx · Add a timeout to the Supabase `getSession()` gate so `ready` cannot hang the app on the loading skeleton when the auth host is slow or unreachable.
- [x] P3 · apps/web/index.html · Move the inline body font stack and the `.vd-scroll` rule into `theme.css` so `font.family` has one definition.
- [x] P3 · apps/web/src/shell/AppShell.tsx · Restyle the offline banner as glass-thin with `--vd-warn-bg/fg` tokens and a 44 px min height instead of an 8 px-padded strip.
