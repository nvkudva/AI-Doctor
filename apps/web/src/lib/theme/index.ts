// Design tokens live in theme.css. This module is only what CANNOT be a CSS
// rule: values a component must branch on in JS (a status label, a tint pair
// chosen from data) and the theme switch itself. Everything metric — spacing,
// radius, elevation, the type scale, breakpoint layout — is a CSS custom
// property or a class in theme.css / a component's own .module.css.
// (main.tsx imports theme.css once, before the app mounts.)

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/** The JS mirror of the media queries in theme.css and the .module.css files. */
export const breakpoints = { tablet: 800, desktop: 1160 } as const;

// Status pill bg|fg|label rows — the single label source (Primitives reads it).
// Five semantic roles and nothing else (DESIGN-REVIEW D19):
//   critical (red)  — a red flag, a breach, a missed dose, out of range
//   warning (amber) — needs attention, or is awaiting someone's action
//   positive (green)— in range, approved, taken: confirmed good, never a default
//   info (blue)     — a neutral category (investigation / prescription / booked)
//   neutral (grey)  — closed, historic, or merely informational
// Amber used to mean "needs a look", "routine", "pending", "closed" AND
// "breached"; green meant "in range", "routine", "approved", "safe" and "zero
// doses taken". A colour that means six things means nothing.
export const statusPill: Record<string, { bg: string; fg: string; label: string }> = {
  // Awaiting someone's action.
  pending: { bg: 'var(--vd-warn-bg)', fg: 'var(--vd-warn-fg)', label: 'Pending' },
  pending_review: { bg: 'var(--vd-warn-bg)', fg: 'var(--vd-warn-fg)', label: 'Pending review' },
  // Confirmed good.
  approved: { bg: 'var(--vd-ok-bg)', fg: 'var(--vd-ok-fg)', label: 'Approved' },
  completed: { bg: 'var(--vd-ok-bg)', fg: 'var(--vd-ok-fg)', label: 'Completed' },
  // Neutral category.
  changes: { bg: 'var(--vd-info-bg)', fg: 'var(--vd-info-fg)', label: 'Changes requested' },
  booked: { bg: 'var(--vd-info-bg)', fg: 'var(--vd-info-fg)', label: 'Booked' },
  prescription: { bg: 'var(--vd-info-bg)', fg: 'var(--vd-info-fg)', label: 'Prescription' },
  investigation: { bg: 'var(--vd-info-bg)', fg: 'var(--vd-info-fg)', label: 'Investigation' },
  // Closed or historic: an outcome, not an alarm.
  rejected: { bg: 'var(--vd-neutral-bg)', fg: 'var(--vd-neutral-fg)', label: 'Declined' },
  expired: { bg: 'var(--vd-neutral-bg)', fg: 'var(--vd-neutral-fg)', label: 'Expired' },
  cancelled: { bg: 'var(--vd-neutral-bg)', fg: 'var(--vd-neutral-fg)', label: 'Cancelled' },
  closed: { bg: 'var(--vd-neutral-bg)', fg: 'var(--vd-neutral-fg)', label: 'Closed' },
  // AI confidence is informational, not a verdict: high confidence is not the
  // same kind of fact as an approved plan, so it does not borrow its green.
  high: { bg: 'var(--vd-info-bg)', fg: 'var(--vd-info-fg)', label: 'High confidence' },
  medium: { bg: 'var(--vd-warn-bg)', fg: 'var(--vd-warn-fg)', label: 'Medium confidence' },
  low: { bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)', label: 'Low confidence' },
  // Urgency. Routine is the default, so it is neutral — not a good outcome.
  urgent: { bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)', label: 'Urgent' },
  soon: { bg: 'var(--vd-warn-bg)', fg: 'var(--vd-warn-fg)', label: 'Soon' },
  routine: { bg: 'var(--vd-neutral-bg)', fg: 'var(--vd-neutral-fg)', label: 'Routine' },
  // A patient who did not attend needs chasing.
  no_show: { bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)', label: 'No-show' },
};

// Semantic bg/fg pairs for tinted blocks — never alpha-over-surface tints,
// which collapse in dark mode (DESIGN §2.2). Only the pairs a component picks
// from data live here; a fixed tint is written straight into its .module.css.
export const tints = {
  labOk: { bg: 'var(--vd-lab-ok-bg)', fg: 'var(--vd-lab-ok-fg)' },
  labWarn: { bg: 'var(--vd-lab-warn-bg)', fg: 'var(--vd-lab-warn-fg)' },
  rx: { bg: 'var(--vd-rx-bg)', fg: 'var(--vd-rx-fg)' },
  investigation: { bg: 'var(--vd-inv-bg)', fg: 'var(--vd-inv-fg)' },
} as const;

export type Style = Record<string, string | number>;

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

const TONE_BG: Record<Tone, string> = {
  ok: 'var(--vd-ok-bg)',
  warn: 'var(--vd-warn-bg)',
  bad: 'var(--vd-bad-bg)',
  info: 'var(--vd-info-bg)',
  neutral: 'var(--vd-surface-chip)',
};

const TONE_FG: Record<Tone, string> = {
  ok: 'var(--vd-ok-fg)',
  warn: 'var(--vd-warn-fg)',
  bad: 'var(--vd-bad-fg)',
  info: 'var(--vd-info-fg)',
  neutral: 'var(--vd-ink-2)',
};

/** A tinted label's colour pair. The material — sheen, edge, lift — comes from
 *  the .vd-tag class, which differs per theme; pair this with className="vd-tag". */
export function toneStyle(tone: Tone): Style {
  return { backgroundColor: TONE_BG[tone], color: TONE_FG[tone] };
}

export type Theme = 'light' | 'dark';

const THEME_KEY = 'vd_theme';

export function getTheme(): Theme {
  if (typeof document !== 'undefined') {
    const t = document.documentElement.dataset.theme;
    if (t === 'light' || t === 'dark') return t;
  }
  try {
    const s = localStorage.getItem(THEME_KEY);
    if (s === 'light' || s === 'dark') return s;
  } catch { /* private mode */ }
  return 'light';
}

// The installed app's title bar and the mobile browser chrome read this meta,
// so it has to follow the switch, not only the first paint. index.html sets it
// pre-paint from the same two grounds.
function syncThemeColor(t: Theme) {
  document.getElementById('vd-theme-color')?.setAttribute('content', t === 'dark' ? '#241B45' : '#CDB6EC');
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  syncThemeColor(t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch { /* private mode */ }
}

// First-load resolution: stored choice wins, else OS preference. Runs in
// main.tsx and in an index.html inline snippet (pre-paint, avoids FOUC).
export function initTheme(): Theme {
  let t: Theme = 'light';
  try {
    const s = localStorage.getItem(THEME_KEY);
    if (s === 'light' || s === 'dark') t = s;
    else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) t = 'dark';
  } catch { /* private mode */ }
  document.documentElement.dataset.theme = t;
  syncThemeColor(t);
  return t;
}
