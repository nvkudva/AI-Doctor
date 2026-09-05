# Virtual Doctor — Design System

**Status:** Binding. `docs/PRD.md` §5.0 (UI-1, UI-2) and §5.0.1 (MC-1…MC-7) govern *what*; this document governs *how it looks and measures*. Implementation checklist: `docs/DESIGN-TASKS.md`.

**Scope:** one PWA, two modules (`patient`, `doctor`) plus `login`, sharing `lib/theme`, `lib/ui`, `shell`. Styling stays as it is today — React inline styles reading `var(--vd-*)` from `lib/theme/theme.css`, aliased in `lib/theme/index.ts`. No Tailwind, no CSS-in-JS. Media queries live in `lib/theme` (`media.*`) and are consumed via small inline `<style>` blocks; JS breakpoints come only from `shell/viewport.ts`.

**Aesthetic target:** Apple / iOS "Liquid Glass" — translucency with backdrop blur, layered depth, circular and pill controls, generous radii, spring motion, full light+dark parity. It must read as a native iOS app that scales to iPad and Mac.

---

## 1. Principles

1. **The patient module is the visual source of truth.** The doctor module adopts its header, cards, chips, buttons, sheets and empty states — never the reverse.
2. **Mobile-first, but never merely stretched.** Every screen has a designed tablet and desktop form (columns, rails, panes), specified in §10 — not a phone layout centred in whitespace.
3. **Glass floats; solid holds content.** Chrome that overlays content is glass. Anything carrying readable text is a solid card. Body text never sits directly on glass.
4. **One token, one value.** No colour, radius, shadow, duration or size literal in module code. If it isn't a `--vd-*` token or a `lib/theme` export, it doesn't ship.
5. **44 px is the floor.** Every interactive target is ≥44×44 CSS px on coarse pointers; ≥32×32 on `pointer: fine`.
6. **Dark is a first-class theme, not an inversion.** Every token is defined in both blocks; nothing is allowed to inherit a light-only literal.
7. **Motion is spring, short, and reversible.** One spring curve, five durations, and full `prefers-reduced-motion` compliance.
8. **One Mira.** `<MiraPresence>` is the only voice surface (MC-1); modules configure it, never fork it.

---

## 2. Colour

### 2.1 Rules

- `theme.css` is the single source. `:root` = light, `[data-theme="dark"]` = dark. **Every** token below must appear in both blocks.
- Module code may not contain `#hex`, `rgb()`, `rgba()` or `oklch()` literals. Today it contains ~60 of them (see §2.4) — every one is a dark-mode bug.
- Alpha-over-surface pairs (`oklch(... / .16)` tints) are forbidden as a colour strategy: they read correctly on white and collapse in dark. Use explicit `-bg` / `-fg` token pairs.

### 2.2 Token table — keep existing names, add the marked ones

| Token | Light | Dark | Use | Action |
|---|---|---|---|---|
| `--vd-bg-app` | `linear-gradient(180deg,#cdb6ec 0%,#d3c2ec 38%,#d8d0ea 72%,#d5d2e4 100%)` | `radial-gradient(120% 80% at 50% 0%,#232031 0%,#17141f 100%)` | patient module ground | keep |
| `--vd-bg-desk` | `linear-gradient(180deg,#efe9fa 0%,#e4dbf3 100%)` | `linear-gradient(180deg,#141119 0%,#191423 100%)` | doctor module ground | keep |
| `--vd-desk-scrim` | `rgba(255,255,255,.72)` | `rgba(20,17,28,.72)` | sticky toolbar scrim | keep |
| `--vd-surface-card` | `#ffffff` | `#222033` | solid content card | keep |
| `--vd-surface-panel` | `#f4f1fc` | `#1c1929` | inset panel / mini-card | keep |
| `--vd-surface-chip` | `#f0ecfb` | `#2a2540` | tinted chip / secondary button | keep |
| `--vd-surface-mine` | `#cfb0f4` | `#4a3f7d` | patient's own chat bubble | keep |
| `--vd-surface-raised` | `#faf8ff` | `#2a2740` | **add** — card-on-card, popover body | **add** |
| `--vd-case-header` | `#e8d5ff` | `#262138` | case header tint | keep |
| `--vd-ink-1` | `#241b45` | `#f2eeff` | titles | keep |
| `--vd-ink-2` | `#3a2e5c` | `#d7cff5` | body | keep |
| `--vd-ink-3` | `#4a5a72` | `#a79fd0` | secondary body | **change light** `#5a6b82` → `#4a5a72` (5.4 → 7.1 on card) |
| `--vd-ink-soft` | `#585379` | `#9b94c7` | supporting copy on the app gradient | **change light** `#6b6790` → `#585379` (3.20 → 4.6) |
| `--vd-ink-4` | `#67628a` | `#928bbd` | muted meta ≥12 px only | **change both** (`#8480a5`→`#67628a`, `#7e78a8`→`#928bbd`) |
| `--vd-ink-on-glass` | `#3d3568` | `#e4dcff` | text on glass chrome | **rename** from `--vd-accent-ink` |
| `--vd-ink-on-brand` | `#ffffff` | `#ffffff` | text on brand/danger fills | keep |
| `--vd-ink-on-approve` | `#06231a` | `#06231a` | text on the approve gradient (6.19) | **add** |
| `--vd-brand-1` | `#3e6fd6` | `#7b8cff` | gradient start | keep |
| `--vd-brand-2` | `#7b4de0` | `#9b5cf0` | gradient end, focus ring | keep |
| `--vd-send-1` / `--vd-send-2` | `oklch(.69 .15 287)` / `oklch(.54 .19 290)` | `oklch(.72 .16 287)` / `oklch(.6 .2 290)` | send button | keep |
| `--vd-nav-active` | `oklch(.46 .2 290)` | `oklch(.78 .16 290)` | active nav item | **change light** (was `.56` → 3.70 on glass; `.46` → 5.9) |
| `--vd-nav-idle` | `#585379` | `#9b94c7` | inactive nav item (2.26 today) | **add** |
| `--vd-ok-bg` / `--vd-ok-fg` | `#bfebd5` / `#0e5a38` | `#123f2c` / `#7fe0b2` | success pill (6.33 / 7.45) | keep |
| `--vd-warn-bg` / `--vd-warn-fg` | `#ffe9a8` / `#6b4e00` | `#4a3a08` / `#ffd97a` | warning pill (6.44) | keep |
| `--vd-info-bg` / `--vd-info-fg` | `#cfe0ff` / `#1d3e86` | `#1e3260` / `#a9c4ff` | info pill | keep |
| `--vd-bad-bg` / `--vd-bad-fg` | `#fbd2da` / `#8e2440` | `#57202f` / `#ff9eb4` | error pill (6.19) | keep |
| `--vd-neutral-bg` / `--vd-neutral-fg` | `#e5e7eb` / `#4b5563` | `#33334a` / `#b9b9d0` | expired pill (6.10) | keep |
| `--vd-lab-ok-bg` / `--vd-lab-ok-fg` | `#dcf3e7` / `#0f5537` | `#16382a` / `#86e2b6` | lab "Normal" result pill | **add** (replaces `oklch(.72 .13 160/.16)` + `oklch(.45 .13 160)`) |
| `--vd-lab-warn-bg` / `--vd-lab-warn-fg` | `#fdeccf` / `#6d4406` | `#3f2f0d` / `#f2c281` | lab "raised" result pill | **add** |
| `--vd-rx-bg` / `--vd-rx-fg` | `#efe1fb` / `#5a2496` | `#332248` / `#d5b4f7` | "Prescription" kind chip | **add** |
| `--vd-inv-bg` / `--vd-inv-fg` | `#d9edf5` / `#12495e` | `#182f3a` / `#a4d8ea` | "Investigation" kind chip | **add** |
| `--vd-advice-bg` / `--vd-advice-fg` | `#dbeef5` / `#14495c` | `#17313c` / `#a8d9e8` | "When to seek help" callout | **add** |
| `--vd-safety-bg` / `--vd-safety-fg` | `#ddf2e7` / `#0e5136` | `#15342a` / `#8ee0bb` | safety-checks callout | **add** |
| `--vd-assessment-bg` / `--vd-assessment-bd` | `#f0e7fd` / `#dcc9f7` | `#2b2340` / `#3d3159` | doctor "Assessment" block | **add** |
| `--vd-glass-bg` | `linear-gradient(180deg, oklch(.93 .045 300/.58), oklch(.9 .05 298/.42))` | `linear-gradient(180deg, oklch(.35 .06 295/.55), oklch(.3 .06 295/.45))` | glass fill | keep |
| `--vd-glass-solid` | `#ede7fa` | `#2b2740` | `@supports` fallback | **add** |
| `--vd-glass-blur` | `blur(22px) saturate(180%)` | same | glass filter | keep |
| `--vd-glass-border` | `oklch(.97 .02 300/.75)` | `oklch(.6 .08 295/.35)` | glass edge | keep |
| `--vd-glass-hi` | `inset 0 1px 1px rgba(255,255,255,.6)` | `inset 0 1px 1px rgba(255,255,255,.18)` | inner highlight | keep |
| `--vd-border` | `rgba(30,50,90,.1)` | `rgba(255,255,255,.14)` | hairline | keep |
| `--vd-border-strong` | `rgba(30,50,90,.2)` | `rgba(255,255,255,.26)` | ghost-button / input border | **add** |
| `--vd-scrim` | `rgba(23,19,51,.45)` | `rgba(8,6,18,.6)` | modal scrim | **add** |
| `--vd-focus` | `#7b4de0` | `#b48cff` | focus ring | **add** |
| `--vd-selected-ring` | `oklch(.6 .2 290/.7)` | `oklch(.72 .18 292/.8)` | selected queue card | **add** |
| `--vd-urgent-glow` | `0 0 0 3px rgba(190,60,90,.16)` | `0 0 0 3px rgba(255,140,170,.18)` | urgent card halo | **add** |
| `--vd-orb-*`, `--vd-state-*` | as today | as today | Mira presence | keep |
| `--vd-shadow-cta` | `0 12px 30px oklch(.42 .2 290/.55)` | `0 8px 20px rgba(0,0,0,.45)` | primary button | keep |
| `--vd-elev-1…5` | see §5 | see §5 | elevation scale | **add** |
| `--vd-dur-1…5`, `--vd-ease-*` | see §6 | see §6 | motion | **add** |
| `--vd-space-*`, `--vd-radius-*` | see §4 | see §4 | metrics | **add** |
| `--vd-accent-ink` | — | — | superseded by `--vd-ink-on-glass` | **delete after rename** |

`lib/theme/index.ts` gains matching aliases: `ink.onGlass` → `--vd-ink-on-glass`, plus `tints`, `space`, `elevation`, `motion`, and `nav.idle`.

### 2.3 Contrast failures found (measured, sRGB, WCAG 2.1)

Dark-mode failures — all caused by hardcoded `oklch()` literals that never flip:

| Pair | Where | Ratio | Required |
|---|---|---|---|
| `oklch(.45 .13 160)` on `oklch(.72 .13 160/.16)` over `#222033` | `RecordsScreen.tsx` LabRow "Normal" | **1.78** | 4.5 |
| `oklch(.42 .13 160)` on same tint over `#222033` | `CaseDetail.tsx` test-history pill | **1.57** | 4.5 |
| `oklch(.5 .14 60)` on `oklch(.8 .14 70/.2)` over `#222033` | lab "Mildly raised" pill (both files) | **1.66** | 4.5 |
| `oklch(.4 .12 160)` on `oklch(.72 .13 160/.12)` over `#222033` | `RecommendationScreen.tsx` safety note | **1.54** | 4.5 |
| `oklch(.45 .12 220)` on `oklch(.7 .13 200/.12)` over `#222033` | `RecommendationScreen.tsx` "When to seek help" | **1.93** | 4.5 |
| `oklch(.45 .19 300)` on `oklch(.62 .2 300/.14)` over `#222033` | Prescription / Investigation kind chip | **1.64** | 4.5 |

Light-mode failures:

| Pair | Where | Ratio | Required |
|---|---|---|---|
| `--vd-ink-4` `#8480a5` on `--vd-bg-app` mid `#d3c2ec` | `BottomNav` inactive labels (11 px) | **2.26** | 4.5 |
| `--vd-ink-4` `#8480a5` on `--vd-surface-card` `#ffffff` | card meta rows, `MicroLabel`, `MetaChip` label | **3.74** | 4.5 |
| `--vd-nav-active` `oklch(.56 .19 290)` on the glass bar (~`#e3d9f4`) | `BottomNav` active label (11 px) | **3.70** | 4.5 |
| `--vd-ink-soft` `#6b6790` on `--vd-bg-app` | home hero subtitle, `SectionSub` | **3.20** | 4.5 |
| `oklch(.85 .04 300)` border on `--vd-surface-mine` `#cfb0f4` | `ConsultView` suggestion-chip border | **1.17** | 3.0 (UI) |
| `--vd-ink-4` `#7e78a8` on `#222033` (dark) | same meta rows in dark | **3.89** | 4.5 |

The `--vd-ink-3` / `--vd-ink-soft` / `--vd-ink-4` / `--vd-nav-active` value changes in §2.2 fix every light-mode row; the `--vd-lab-*`, `--vd-rx-*`, `--vd-inv-*`, `--vd-advice-*`, `--vd-safety-*` token pairs fix every dark-mode row.

### 2.4 Literals to purge

`LoginPage.tsx` (`rgba(255,255,255,.55)`, `rgba(36,27,69,.25|.2|.12)`, `rgba(46,37,71,.25|.18)`), `AppShell.tsx` (`#241B45`), `MiraFloat.tsx` (`rgba(28,24,55,.85|.9|.78)`, `rgba(255,255,255,.85|.9|.92|.2|.16|.14|.12)`, `#3A2E5C`, `#241B45`), `CaseDetail.tsx` (`rgba(6,35,26,.25)`, three `oklch()` tints), `QueueCard.tsx` (`oklch(.6 .2 290/.7)`, two shadow literals), `ConsultView.tsx` (`rgba(90,70,180,.28)`, `oklch(.85 .04 300)`, `oklch(.6 .1 290/.16|.2)`, `rgba(180,30,60,.5)`), `RecommendationScreen.tsx` (nine `oklch()` literals, `#7A5AE0`), `RecordsScreen.tsx` (four `oklch()` literals), `DeskHeader.tsx` (`oklch(.62 .21 20)`, `rgba(90,70,170,.22)`), `AccountMenu.tsx` / `DeclineSheet.tsx` shadow literals.

---

## 3. Type scale

Family: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif` (`font.family`). Weights used: 400, 600, 700 only.

Sizes step up at tablet and desktop. Implement as three variants in `type` (`type.body`, `type.bodyT`, `type.bodyD`) or as a `useTypeScale()` helper keyed off `shell/viewport` — one mechanism, applied everywhere.

| Role | Mobile <800 | Tablet 800–1159 | Desktop ≥1160 | Weight | Line-height | Tracking | Used for |
|---|---|---|---|---|---|---|---|
| `display` **(add)** | 30 | 34 | 38 | 700 | 1.1 | −0.022em | login hospital name |
| `largeTitle` | 26 | 30 | 32 | 700 | 1.15 | −0.02em | screen titles: "Good evening", "Records", "Your plan", "Review" |
| `title` | 20 | 22 | 24 | 700 | 1.2 | −0.015em | sheet titles, case patient name at desktop |
| `headline` | 16 | 17 | 18 | 700 | 1.3 | −0.01em | card titles, plan item names, "Dr. Mira is ready" |
| `body` | 15 | 16 | 16 | 400 | 1.55 | 0 | primary reading text, chat turns, summaries |
| `callout` | 14 | 15 | 15 | 400 | 1.5 | 0 | secondary reading text, list rows |
| `subhead` **(add)** | 13 | 14 | 14 | 600 | 1.45 | 0 | segmented-control labels, button labels ≤secondary |
| `footnote` | 12 | 13 | 13 | 400 | 1.45 | 0 | meta rows, timestamps, helper text |
| `caption` | 11 | 12 | 12 | 600 | 1.35 | 0.01em | nav labels, status pill text |
| `micro` | 11 | 11 | 11 | 700 | 1.2 | 0.07em, uppercase | `MicroLabel` section eyebrows |

Rules:
- Delete every fractional size in the codebase (`12.5`, `13.5`, `1.5px` borders excepted). There are 40+; each maps to `footnote` or `callout`.
- Doctor module currently reads at `12`–`12.5` where patient reads at `13`–`13.5`. Both become `callout`/`footnote` from the table above.
- All `<input>` / `<textarea>` stay at **16 px on mobile** regardless of role (iOS zoom-on-focus); they may use `callout` at ≥800.
- Never centre-align paragraphs longer than two lines. Reading measure caps at **68 ch**.

---

## 4. Spacing & radius

### 4.1 Spacing — 4 px base

| Token | px | Use |
|---|---|---|
| `--vd-space-1` | 4 | icon↔label, badge insets |
| `--vd-space-2` | 6 | chip row gaps |
| `--vd-space-3` | 8 | tight stack, button group gap |
| `--vd-space-4` | 12 | card inner stack, list row padding |
| `--vd-space-5` | 16 | card padding (mobile), section gap |
| `--vd-space-6` | 20 | page gutter (mobile), card padding (tablet+) |
| `--vd-space-7` | 24 | pane gutter, section break |
| `--vd-space-8` | 32 | page gutter (desktop), major section break |
| `--vd-space-9` | 40 | hero block spacing |
| `--vd-space-10` | 56 | desktop vertical rhythm between regions |

Page gutters: **20** mobile · **28** tablet · **32** desktop (patient) / **40** desktop (doctor, 3-pane). Grid gutters: **12** mobile · **20** tablet · **24** desktop.

### 4.2 Radius

| Token | px | Use | Replaces |
|---|---|---|---|
| `--vd-radius-xs` | 8 | inline badges, mini tints | ad-hoc `9` |
| `--vd-radius-sm` | 12 | mini-cards, menu rows, inset blocks | `radius.sm: 9`, ad-hoc `12`/`14` |
| `--vd-radius-md` | 16 | standard content card | `radius.card: 16` |
| `--vd-radius-lg` | 20 | large card, side panel, popover | `radius.panel: 22` |
| `--vd-radius-xl` | 24 | modal / sheet body | ad-hoc `20`/`22` |
| `--vd-radius-2xl` | 28 | glass dock, nav bar | `radius.dock: 26`, ad-hoc `32`/`34` |
| `--vd-radius-pill` | 999 | every pill control | `radius.pill: 99` |

Nested-radius rule: an inner element's radius = outer radius − its inset (e.g. a 12 px inset inside a 28 px dock → 16 px).

---

## 5. Elevation

Shadows carry hue, never neutral grey. Dark mode drops opacity and blur radius; glass surfaces add `var(--vd-glass-hi)` as the first layer.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--vd-elev-0` | `none` | `none` | flat inset panels |
| `--vd-elev-1` | `0 2px 8px rgba(12,20,60,.10)` | `0 2px 8px rgba(0,0,0,.4)` | list rows, chips |
| `--vd-elev-2` | `0 6px 18px rgba(12,20,60,.14)` | `0 6px 16px rgba(0,0,0,.45)` | resting cards, queue cards |
| `--vd-elev-3` | `0 12px 28px rgba(12,20,60,.20)` | `0 12px 26px rgba(0,0,0,.5)` | selected card, sticky toolbars |
| `--vd-elev-4` | `0 14px 34px oklch(.45 .12 295/.30), 0 2px 8px rgba(46,37,71,.14)` | `0 14px 32px rgba(0,0,0,.55)` | glass dock, bottom nav, FAB |
| `--vd-elev-5` | `0 24px 60px rgba(12,20,60,.35)` | `0 24px 56px rgba(0,0,0,.6)` | popovers, sheets, modals |

`shadows` in `lib/theme/index.ts` becomes `elevation = {0..5}` mapping to these; the current `chip`/`card`/`cta`/`popover` keys are deleted after migration (`cta` survives as `--vd-shadow-cta`, which is a brand glow, not an elevation).

---

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--vd-dur-1` | `120ms` | colour/opacity hovers |
| `--vd-dur-2` | `180ms` | press scale, toggles, chip selection |
| `--vd-dur-3` | `240ms` | popovers, menus, segmented indicator |
| `--vd-dur-4` | `320ms` | sheets, pane transitions, orb minimise/maximise |
| `--vd-dur-5` | `420ms` | screen-level transitions, hero entrance |
| `--vd-ease-spring` | `cubic-bezier(.32,.72,.35,1)` | default for everything (existing `--vd-spring`) |
| `--vd-ease-out` | `cubic-bezier(.2,.8,.3,1)` | entrances |
| `--vd-ease-in` | `cubic-bezier(.4,0,1,1)` | exits |
| `--vd-ease-overshoot` | `cubic-bezier(.34,1.56,.64,1)` | FAB, orb pop, badge appear |

Standing behaviours: `[role="button"]:active { transform: scale(.97) }` at `--vd-dur-2` (already global — keep, extend to `button`); Mira state animations (`vd-listen` 1.2 s, `vd-think`, `vd-speak` 0.9 s, `vd-breathe` 4 s) unchanged; `prefers-reduced-motion` block already neutralises all of it — keep it and add `scroll-behavior: auto`.

---

## 7. Control metrics

**44 px minimum touch target on coarse pointers.** Where a control is visually smaller, the hit area is expanded with padding or an `::before` overlay — never by shrinking the target. On `@media (pointer: fine)` the floor drops to 32 px.

| Control | Mobile <800 | Tablet 800–1159 | Desktop ≥1160 | Radius | Type | Notes |
|---|---|---|---|---|---|---|
| Primary button | h 48, pad 0 24 | h 50, pad 0 28 | h 52, pad 0 32 | pill | `subhead`→`body` 700 | `gradients.primary` + `--vd-shadow-cta` |
| Secondary (tinted) | h 48, pad 0 20 | h 50, pad 0 24 | h 50, pad 0 24 | pill | 700 | `--vd-surface-chip`, no shadow |
| Tertiary (ghost) | h 48, pad 0 20 | h 48, pad 0 20 | h 48, pad 0 20 | pill | 600 | 1 px `--vd-border-strong` |
| Destructive | as primary | as primary | as primary | pill | 700 | `gradients.danger`, `--vd-ink-on-brand` |
| Approve (doctor) | h 48, pad 0 18 | h 48 | h 48 | pill (split: `24px 0 0 24px` / `0 24px 24px 0`) | 700 | `gradients.approve`, `--vd-ink-on-approve`; chevron half w 48 |
| Circular icon button | 44×44, icon 20 | 44×44, icon 20 | 40×40 visual / 44 hit, icon 20 | circle | — | **all current 38 px instances go to 44** |
| Pill chip (selectable) | h 44, pad 0 14 | h 40, pad 0 16 | h 40, pad 0 16 | pill | `footnote` 600 | 1 px `--vd-border-strong`; selected = `--vd-surface-mine` |
| Status pill (static) | h 22, pad 0 9 | h 24, pad 0 10 | h 24, pad 0 10 | pill | `micro` uppercase | not interactive → exempt from 44 |
| Text input | h 48, font 16 | h 50, font 16 | h 52, font 16 | pill or `md` | — | pad 0 16; trailing 44 circular send |
| Textarea | min-h 96, font 16 | min-h 104 | min-h 112 | `md` | — | pad 12 14, 1 px `--vd-border-strong` |
| Segmented control | h 44, pad 3 | h 44, pad 3 | h 40, pad 3 | pill | `subhead` | indicator = `--vd-surface-raised` + `--vd-elev-1` |
| Bottom-nav item | h 56 (bar 62), icon 23, label `caption` | — | — | — | — | mobile only |
| Rail nav item (tablet) | — | 44×44, icon 22 | — | `sm` | — | icon-only, tooltip on hover |
| Sidebar nav item (desktop) | — | — | h 44, pad 0 12, icon 20 | `sm` | `subhead` | label + icon |
| FAB (consult) | 62×62, icon 27 | — | — | circle | — | mobile only; becomes a rail/sidebar primary at ≥800 |
| Mira float orb (doctor) | 60×60 | 64×64 | 64×64 | circle | — | offset 16 / 24 / 28 from the edges |
| Menu / list row | min-h 44, pad 0 12 | min-h 44 | min-h 40 | `sm` | `callout` 600 | |
| Card (content) | pad 16, radius `md` | pad 20, radius `lg` | pad 20–24, radius `lg` | — | — | `--vd-elev-2` |

Focus: `:focus-visible { outline: 2px solid var(--vd-focus); outline-offset: 2px }` — already global; add `border-radius: inherit` on custom-shaped targets.

---

## 8. Liquid Glass

### 8.1 Recipe

```css
/* .vd-glass — the ONLY way to make a glass surface */
background: var(--vd-glass-bg);
backdrop-filter: var(--vd-glass-blur);          /* blur(22px) saturate(180%) */
-webkit-backdrop-filter: var(--vd-glass-blur);
border: 1px solid var(--vd-glass-border);
box-shadow:
  var(--vd-glass-hi),                            /* inner top highlight */
  inset 0 -1px 0 rgba(255,255,255,.10),          /* inner bottom lift */
  var(--vd-elev-4);                              /* outer drop */
border-radius: var(--vd-radius-2xl);             /* or pill for bars */
```

Three intensities, same structure:

| Variant | Blur | Where |
|---|---|---|
| `glass-thin` | `blur(14px) saturate(150%)` | sticky headers, toolbars over content |
| `glass` (default) | `blur(22px) saturate(180%)` | bottom nav, dock, FAB, rails, popovers |
| `glass-thick` | `blur(32px) saturate(190%)` | modal scrims, full-screen sheets |

### 8.2 Glass vs solid

**Glass** — only for chrome that floats over scrolling content and never holds a paragraph: bottom nav / sidebar rail, the consult call dock, the FAB, sticky section headers, the Mira float orb, popover and menu *containers*, sheet grab-handles, back-to-queue pills, the notification bell.

**Solid card** (`--vd-surface-card`, `--vd-elev-2`) — everything that holds readable content: queue cards, case detail blocks, plan cards, records rows, profile cards, the sign-in card, modal bodies, the Mira transcript panel. Body text ≤14 px never sits on glass.

Never nest glass inside glass. Never place glass on glass-adjacent gradients without a content layer between them.

### 8.3 Fallbacks

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .vd-glass { background: var(--vd-glass-solid); }
}
@media (prefers-reduced-transparency: reduce) {
  .vd-glass { background: var(--vd-glass-solid); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
```

`--vd-glass-solid` is opaque and matches the glass midpoint in each theme, so nothing shifts more than a tone. Because inline styles cannot express `@supports`, glass must move out of per-component inline styles into a `.vd-glass` / `.vd-glass-thin` / `.vd-glass-thick` class set in `theme.css`; components apply the class and keep only geometry inline.

---

## 9. Breakpoints

| Name | Range | JS | CSS |
|---|---|---|---|
| mobile | `< 800` | `useIsMobile()` → `(max-width: 799.98px)` | `@media (max-width: 799.98px)` |
| tablet | `800 – 1159` | `useBreakpoint() === 'tablet'` | `media.tabletUp` + `(max-width: 1159.98px)` |
| desktop | `≥ 1160` | `useBreakpoint() === 'desktop'` | `media.desktopUp` = `(min-width: 1160px)` |

`shell/viewport.ts` today uses `max-width: 800px` while `media.tabletUp` is `min-width: 800px` — **at exactly 800 px both are true**. Fix to `799.98px` and add `useBreakpoint(): 'mobile' | 'tablet' | 'desktop'`; add `media.desktopUp`. Modules must not call `matchMedia` themselves.

---

## 10. Layout specs per breakpoint

Shared: the app shell never introduces its own chrome; each module owns its layout. Page background = `gradients.app` (patient/login) or `gradients.desk` (doctor). Vertical safe areas via `env(safe-area-inset-*)` on mobile only.

### 10.1 Patient navigation *(this replaces the bottom nav above 800 px)*

| | Mobile | Tablet | Desktop |
|---|---|---|---|
| Form | floating glass pill bottom nav | **left icon rail** | **left labelled sidebar** |
| Metrics | bar h 62, max-w 352, centred, bottom `20 + safe-area`, radius pill, `--vd-elev-4` | w 76, full height, sticky, radius `2xl`, margin 16, glass | w 248, full height, sticky, radius `2xl`, margin 20, glass |
| Items | 4 (Home, History, Labs, Profile) + centre FAB 62 | 4 × 44×44 icon buttons, gap 8, tooltips | 4 × 44 rows (icon 20 + `subhead` label), gap 4 |
| Consult entry | centre FAB, overlaps bar by 30 px | 44 circular primary pinned at rail top | full-width 48 primary "Start consultation" pinned at sidebar top |
| Account | in-page header `AccountMenu` | pinned at rail bottom (44 avatar) | pinned at sidebar bottom (row: avatar + name) |

The bottom nav component stays; `PatientFlow` renders `<SideNav>` instead at ≥800.

### 10.2 Patient home

| | Mobile | Tablet | Desktop |
|---|---|---|---|
| Container | 100%, gutter 20, bottom pad 118 | max-w 900, gutter 28 | max-w 1200 (sidebar 248 + gap 32 + content), gutter 32 |
| Columns | 1 | 2 — `minmax(0,1fr) 300px`, gap 24 | 2 — `minmax(0,640px) 340px`, gap 32, block centred in the content column |
| Orb | 152 | 168 | 184 |
| Greeting | inline row with `AccountMenu` | same row, above the grid, aligned to the grid's left edge | in the sidebar-adjacent content header; `AccountMenu` moves to the sidebar |
| Hero block | centred, full width | centred within column 1 | centred within column 1, vertically centred in the viewport (min-h `calc(100dvh - 160px)`) |
| Aside "How a visit works" | hidden | visible, sticky top 28 | visible, sticky top 32, plus a third card: latest plan status |

### 10.3 Patient consult *(MC-4 / MC-5)*

| | Mobile | Tablet | Desktop |
|---|---|---|---|
| Container | 100%, padding 16 20 26 | max-w 1000 centred, gutter 28 | max-w 1360, sidebar 248 + stage + panel |
| Columns | 1 (stage only) | `minmax(0,1fr) 300px`, gap 20 — **the whole grid is centred**, not the main column inside its track | `248px minmax(0,720px) 340px`, gap 32, grid centred |
| Orb | 104 | 128 | 160 |
| Transcript | flex-1, `max-height: 40dvh` | fills the column, `max-height: none` | fills the column, `max-height: none`, min-h 320 |
| Composer | pinned above the dock | inline under the transcript, max-w 720 | inline, max-w 720 |
| Call dock | glass, centred, h 66, above safe area | glass, centred under the composer | glass, centred under the composer; **not** floating mid-page |
| Mute | one control only — in the dock. Delete the duplicate header mic button. | | |
| Side panel | hidden | "This visit" + "Good to know" cards, sticky | same + live safety-flag card |

### 10.4 Patient recommendation

| | Mobile | Tablet | Desktop |
|---|---|---|---|
| Container | 100%, gutter 20 | max-w 980, gutter 28 | max-w 1320 (sidebar 248 + main 720 + rail 340), gutter 32 |
| Columns | 1 | `minmax(0,1fr) 300px` — plan in col 1; doctor card + "What happens next" in col 2, sticky | `248 / 720 / 340` |
| Orb | 70 | 88 | 96 |
| Actions | stacked, full-width primary then a 2-up ghost row | primary + ghosts in one row under the plan, max-w 560 | sticky action bar at the bottom of the main column, glass, h 72 |
| Timeline | inline after the plan | in the right rail | in the right rail |

### 10.5 Patient records

| | Mobile | Tablet | Desktop |
|---|---|---|---|
| Container | 100%, gutter 20, bottom pad 118 | max-w 860, gutter 28 | max-w 1180 (sidebar 248 + content), gutter 32 |
| Segmented control | full width, h 44 | max-w 420, left-aligned, h 44 | max-w 420, left-aligned, h 40 |
| History cards | 1 col | 1 col, max-w 720 | 2 cols `repeat(auto-fill, minmax(340px,1fr))`, gap 24 |
| Labs / documents | 1 col | 2 cols, gap 20 | 3 cols, gap 24 |
| Profile stats | 3-up row | 3-up, max-w 560 | 3-up, max-w 640 |
| Coverage cards | 2-up, `align-items: stretch` (they are ragged today) | 2-up, max-w 720 | 2-up, max-w 720 |
| Dark-mode fix | segmented indicator uses `--vd-surface-raised` (invisible today) | | |

### 10.6 Doctor queue

| | Mobile | Tablet | Desktop |
|---|---|---|---|
| Container | 100%, gutter 16, bottom pad 100 | 100%, gutter 28 | max-w 1560 centred, gutter 40 |
| Panes | 1 — queue list only; a case opens as a full-screen route | 2 — queue 320 fixed + detail `minmax(0,1fr)` (detail max-w 760), gap 24 | 3 — queue 340 + case `minmax(0,760px)` + patient panel 340, gap 24 |
| Header | sticky glass-thin, h 64, title + bell + avatar; subtitle row hidden, count moves into a pill next to the title | sticky glass-thin, h 72 | sticky glass-thin, h 76, full width, with a filter segmented control (All / Pending / Urgent) on the right |
| Queue cards | full width, min-h 96 | 320 col, min-h 104 | 340 col, min-h 104 |
| Empty state | **renders inside the layout with the header** (today it replaces the whole page) — centred card, orb 88, `headline` + `callout` + a "Refresh" tertiary | same | same, in the case pane |
| Third pane content | — | — | patient profile, history, test history (moved out of the case column, per D-3) |

### 10.7 Doctor case detail

| | Mobile | Tablet | Desktop |
|---|---|---|---|
| Entry | full-screen route; back = 44 glass pill, sticky top | inline in pane 2 | inline in pane 2 |
| Header | sticky glass-thin: name + demo + status pill. **Actions move to a sticky bottom action bar** (glass, h 72, safe-area padded): "Approve & send" primary + 44 overflow | sticky top toolbar, actions right-aligned split button | same as tablet |
| Content col | 1 | 1, max-w 720 | 1, max-w 760 — history + labs move to pane 3 |
| Cards | `md` radius, pad 16, `--vd-elev-2`, gap 12 | `lg`, pad 20, gap 16 | `lg`, pad 20–24, gap 20 |
| Reading measure | — | ≤68 ch | ≤68 ch (today the summary runs ~90 ch at 1440) |
| Decision menu | anchored popover, `--vd-elev-5`, min-w 220 | same | same |

### 10.8 Doctor mobile navigation *(missing entirely today)*

Below 800 px the doctor module renders the **same** glass bottom-nav component as the patient module: 5 slots — Queue, Alerts, **Mira (centre FAB 62)**, Approved, Account. Bar h 62, max-w 352, bottom `16 + safe-area`, `--vd-elev-4`. The `MiraFloat` orb is suppressed below 800 (the FAB replaces it) and the case-detail action bar sits above the nav (`bottom: 78 + safe-area`).

At ≥800 the doctor module uses the same rail/sidebar as the patient module (§10.1) with doctor items, and `MiraFloat` returns as a 64 px orb at `right: 24 / 28, bottom: 24 / 28`.

### 10.9 Login

| | Mobile | Tablet | Desktop |
|---|---|---|---|
| Container | card max-w 420, gutter 24, vertically centred | 2-col split, max-w 900, gap 48 | 2-col split, max-w 1080, gap 64 |
| Left column | — | brand: orb 152, `display` name, reassurance copy | brand: orb 184, `display` name, reassurance copy, three trust bullets |
| Right column | the whole page | sign-in card 420, solid `--vd-surface-card`, radius `xl`, pad 28, `--vd-elev-3` | same card, 440 wide, pad 32 |
| Known bug | the container sets `width:min(560px,100%)` **and** `flex:1`, so at ≥560 px it stretches to the full viewport — buttons run 1400 px wide at desktop. Drop `flex:1`; use `width:min(420px,100%)` + `margin:auto`. | | |
| Adult gate | full-width toggle row, h 56, radius `md`, `--vd-surface-card` (currently a white literal → no dark mode) | in-card | in-card |
| Demo accounts | 2-up | 2-up | 2-up |

### 10.10 `<MiraPresence>` per breakpoint *(MC-4 / MC-5)*

| Context | Mobile | Tablet | Desktop |
|---|---|---|---|
| Consult stage (maximised) | 104 | 128 | 160 |
| Home hero (idle) | 152 | 168 | 184 |
| Recommendation (confirmation) | 70 | 88 | 96 |
| Minimised orb (floating) | 38 inside a 60 glass puck, `right/bottom: 16` | 40 inside 64, `right/bottom: 24` | 40 inside 64, `right/bottom: 28` |
| Login | 138 | 152 | 184 |
| Doctor review panel | 72 | 92 | 92 |

Behaviour: the minimised orb is **app-shell-level** (MC-5) so it survives in-module navigation; it is present in *both* modules, over records, home, the queue and case detail; it is dismissable and remembers its last state. Tapping it maximises into the consultation view (`--vd-dur-4`, `--vd-ease-spring`, transform-origin at the orb); the maximised view's minimise control returns it. The session is never torn down by either transition. The orb must not occlude the primary action: on mobile it offsets to `bottom: 78 + safe-area` whenever a bottom nav or action bar is present.

---

## 11. Cross-module consistency rules

The doctor module must adopt these from the patient module. Each is a shared component in `lib/ui`, not a copy.

1. **Header** — `<AppHeader title actions subtitle?>`: `largeTitle` title, 44 circular glass action buttons, `AccountMenu` last, sticky glass-thin at ≥800. Patient home/records and the doctor desk render the same component.
2. **Cards** — `<Card>`: `--vd-surface-card`, radius `md`/`lg` per breakpoint, `--vd-elev-2`, pad from §7. The doctor's `color-mix(... 60%, transparent)` and `... 45%, transparent)` card fills are deleted; translucency belongs to chrome, not content.
3. **Chips** — one `<Chip>` for suggestion chips, decline-reason chips and Mira quick commands: h 44/40, pill, `--vd-border-strong`, `footnote` 600, selected = `--vd-surface-mine`. Three separate implementations exist today.
4. **Buttons** — one `<Button variant="primary|secondary|tertiary|danger|approve">`. The doctor's raw `<button>` elements (`approveBtn`, `sheetSecondary`, `sheetDanger`, MiraFloat's five) and the patient's div-based CTAs collapse into it. This also removes the `fontFamily:'inherit'` repeated on every `<button>` (add `button, input, textarea { font: inherit }` to `theme.css`).
5. **Status pills** — `<StatusPill>` only; `theme.statusPill` becomes the single label source (`Primitives.labelOf` duplicates it today). Urgency ("Urgent"/"Soon") becomes `<StatusPill status="urgent|soon">` rather than two inline `<span>`s in `QueueCard`.
6. **Empty states** — `<EmptyState icon title body action?>`: centred, orb or icon 88, `headline` + `callout`, optional tertiary button. Used by records tabs, the doctor's empty queue (which must keep the header), and `EmptyRecommendation`.
7. **Sheets** — `<Sheet>`: `--vd-scrim` + glass-thick backdrop, body `--vd-surface-card`, radius `xl`, grab handle 36×4, `vd-slidein` at `--vd-dur-4`, Escape + outside-tap dismiss (`useDismiss` + `DismissCatcher`), bottom-anchored on mobile, centred on desktop. The patient's end-visit confirm (no scrim, no outside-tap dismiss today) and the doctor's `DeclineSheet` both use it.
8. **Popovers / menus** — `<Popover>`: `--vd-surface-card`, radius `lg`, pad 6–8, `--vd-elev-5`, rows min-h 44, `z.popover`. `AccountMenu`, the notification dropdown and `CaseDetail`'s decision menu all use it. `CaseDetail`'s menu currently renders at `z.toast` (60) — above the toast layer — and `DeclineSheet` renders at `z.popover` (30), below `z.nav` (40), so a bottom nav would paint over a modal. Fix the z-scale: `sticky 6 < header 10 < nav 40 < sheet 50 < catcher 55 < popover 60 < toast 70`.
9. **Disclosure** — replace the `▶` text glyph with `Icon name="chevD"` rotated; the icon set is the only glyph source (`Primitives` says so already).
10. **Section labels** — `MicroLabel` gets `margin: 16px 0 8px` built in; the doctor cards currently render consecutive labels with zero spacing.
11. **Mira** — the doctor's `MiraFloat` is a second voice UI (its own transcript, chips, composer, dark-navy palette, hardcoded whites) and violates MC-1/MC-3. It must become `<MiraPresence audience="doctor">` with the suggestion panel supplied as a slot, styled from tokens, in both themes.
12. **Text colours** — the doctor module's `12`/`12.5 px` reading text moves to `callout`/`footnote`; `ink.secondary` replaces its ad-hoc greys, so both modules read at the same weight and size.
