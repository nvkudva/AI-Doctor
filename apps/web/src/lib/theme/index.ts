// Design tokens: thin TS aliases over theme.css variables (single source of
// truth). Every value resolves per data-theme, so components get light + dark
// free. Import './theme.css' once (apps/web/src/main.tsx does).

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export const ink = {
  primary: 'var(--vd-ink-1)',
  body: 'var(--vd-ink-2)',
  secondary: 'var(--vd-ink-3)',
  soft: 'var(--vd-ink-soft)',
  muted: 'var(--vd-ink-4)',
  onGlass: 'var(--vd-ink-on-glass)',
  onBrand: 'var(--vd-ink-on-brand)',
  onApprove: 'var(--vd-ink-on-approve)',
};

export const gradients = {
  app: 'var(--vd-bg-app)',
  desk: 'var(--vd-bg-desk)',
  primary: 'linear-gradient(135deg,var(--vd-brand-1),var(--vd-brand-2))',
  approve: 'linear-gradient(180deg, oklch(0.73 0.15 155), oklch(0.63 0.16 160))',
  call: 'linear-gradient(158deg,oklch(0.75 0.12 300),oklch(0.6 0.17 292))',
  send: 'linear-gradient(135deg,var(--vd-send-1),var(--vd-send-2))',
  danger: 'linear-gradient(135deg,#E5484D,#B31B34)',
  glassBar: 'var(--vd-glass-bg)',
};

export const surfaces = {
  card: 'var(--vd-surface-card)',
  panel: 'var(--vd-surface-panel)',
  chip: 'var(--vd-surface-chip)',
  raised: 'var(--vd-surface-raised)',
  bubbleMine: 'var(--vd-surface-mine)',
  caseHeader: 'var(--vd-case-header)',
};

// Semantic bg/fg pairs for tinted blocks — never alpha-over-surface tints,
// which collapse in dark mode (DESIGN §2.2).
export const tints = {
  labOk: { bg: 'var(--vd-lab-ok-bg)', fg: 'var(--vd-lab-ok-fg)' },
  labWarn: { bg: 'var(--vd-lab-warn-bg)', fg: 'var(--vd-lab-warn-fg)' },
  rx: { bg: 'var(--vd-rx-bg)', fg: 'var(--vd-rx-fg)' },
  investigation: { bg: 'var(--vd-inv-bg)', fg: 'var(--vd-inv-fg)' },
  advice: { bg: 'var(--vd-advice-bg)', fg: 'var(--vd-advice-fg)' },
  safety: { bg: 'var(--vd-safety-bg)', fg: 'var(--vd-safety-fg)' },
  assessment: { bg: 'var(--vd-assessment-bg)', bd: 'var(--vd-assessment-bd)' },
} as const;

export const lines = {
  hairline: 'var(--vd-border)',
  strong: 'var(--vd-border-strong)',
  glass: 'var(--vd-glass-border)',
  focus: 'var(--vd-focus)',
  selected: 'var(--vd-selected-ring)',
  scrim: 'var(--vd-scrim)',
} as const;

export const nav = {
  active: 'var(--vd-nav-active)',
  idle: 'var(--vd-nav-idle)',
  /** @deprecated use nav.idle */
  muted: 'var(--vd-nav-idle)',
};

// DESIGN §4.1 — 4px base. Numbers, because inline styles want numbers.
export const space = {
  1: 4, 2: 6, 3: 8, 4: 12, 5: 16, 6: 20, 7: 24, 8: 32, 9: 40, 10: 56,
} as const;

// DESIGN §4.2. Legacy keys stay as aliases until every call site migrates.
export const radius = {
  xs: 8, sm: 12, md: 16, lg: 20, xl: 24, '2xl': 28, pill: 999,
  /** @deprecated use radius.md */
  card: 16,
  /** @deprecated use radius.lg */
  panel: 20,
  /** @deprecated use radius['2xl'] */
  dock: 28,
} as const;

// DESIGN §5 — hued shadows, dark-aware. Index by depth.
export const elevation = {
  0: 'var(--vd-elev-0)',
  1: 'var(--vd-elev-1)',
  2: 'var(--vd-elev-2)',
  3: 'var(--vd-elev-3)',
  4: 'var(--vd-elev-4)',
  5: 'var(--vd-elev-5)',
} as const;

/** @deprecated use `elevation` (cta is a brand glow, not an elevation). */
export const shadows = {
  chip: elevation[1],
  card: elevation[2],
  cta: 'var(--vd-shadow-cta)',
  popover: elevation[5],
};

// DESIGN §6 — one spring, five durations.
export const motion = {
  dur: {
    1: 'var(--vd-dur-1)', 2: 'var(--vd-dur-2)', 3: 'var(--vd-dur-3)',
    4: 'var(--vd-dur-4)', 5: 'var(--vd-dur-5)',
  },
  ease: {
    spring: 'var(--vd-ease-spring)',
    out: 'var(--vd-ease-out)',
    in: 'var(--vd-ease-in)',
    overshoot: 'var(--vd-ease-overshoot)',
  },
} as const;

export const font = {
  family: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif`,
  micro: '11px',
};

// DESIGN §7 — control metrics per breakpoint. Visual size; the hit area never
// drops below 44 on coarse pointers.
export const control = {
  btn: { mobile: 48, tablet: 50, desktop: 52 },
  icon: { mobile: 44, tablet: 44, desktop: 40 },
  chip: { mobile: 44, tablet: 40, desktop: 40 },
  input: { mobile: 48, tablet: 50, desktop: 52 },
} as const;

export function controlSize(key: keyof typeof control, bp: Breakpoint = 'mobile'): number {
  return control[key][bp];
}

export interface TextStyle {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: string;
  textTransform?: 'uppercase';
}

const role = (
  sizes: [number, number, number], fontWeight: number, lineHeight: number,
  letterSpacing = '0', upper = false,
): Record<Breakpoint, TextStyle> => ({
  mobile: { fontSize: sizes[0], fontWeight, lineHeight, letterSpacing, ...(upper ? { textTransform: 'uppercase' as const } : {}) },
  tablet: { fontSize: sizes[1], fontWeight, lineHeight, letterSpacing, ...(upper ? { textTransform: 'uppercase' as const } : {}) },
  desktop: { fontSize: sizes[2], fontWeight, lineHeight, letterSpacing, ...(upper ? { textTransform: 'uppercase' as const } : {}) },
});

// DESIGN §3 — every role in three sizes. `X` = mobile (the default),
// `XT` = tablet, `XD` = desktop; `typeAt(role, bp)` picks one at runtime.
export const typeScale = {
  display: role([30, 34, 38], 700, 1.1, '-0.022em'),
  largeTitle: role([26, 30, 32], 700, 1.15, '-0.02em'),
  title: role([20, 22, 24], 700, 1.2, '-0.015em'),
  headline: role([16, 17, 18], 700, 1.3, '-0.01em'),
  body: role([15, 16, 16], 400, 1.55),
  callout: role([14, 15, 15], 400, 1.5),
  subhead: role([13, 14, 14], 600, 1.45),
  footnote: role([12, 13, 13], 400, 1.45),
  caption: role([11, 12, 12], 600, 1.35, '0.01em'),
  micro: role([11, 11, 11], 700, 1.2, '0.07em', true),
} as const;

export type TypeRole = keyof typeof typeScale;

export function typeAt(r: TypeRole, bp: Breakpoint = 'mobile'): TextStyle {
  return typeScale[r][bp];
}

// Spreadable text styles. Bare key = mobile; `T` / `D` suffix = tablet /
// desktop, for inline <style> media blocks and breakpoint-aware components.
export const type = {
  display: typeScale.display.mobile, displayT: typeScale.display.tablet, displayD: typeScale.display.desktop,
  largeTitle: typeScale.largeTitle.mobile, largeTitleT: typeScale.largeTitle.tablet, largeTitleD: typeScale.largeTitle.desktop,
  title: typeScale.title.mobile, titleT: typeScale.title.tablet, titleD: typeScale.title.desktop,
  headline: typeScale.headline.mobile, headlineT: typeScale.headline.tablet, headlineD: typeScale.headline.desktop,
  body: typeScale.body.mobile, bodyT: typeScale.body.tablet, bodyD: typeScale.body.desktop,
  callout: typeScale.callout.mobile, calloutT: typeScale.callout.tablet, calloutD: typeScale.callout.desktop,
  subhead: typeScale.subhead.mobile, subheadT: typeScale.subhead.tablet, subheadD: typeScale.subhead.desktop,
  footnote: typeScale.footnote.mobile, footnoteT: typeScale.footnote.tablet, footnoteD: typeScale.footnote.desktop,
  caption: typeScale.caption.mobile, captionT: typeScale.caption.tablet, captionD: typeScale.caption.desktop,
  micro: typeScale.micro.mobile, microT: typeScale.micro.tablet, microD: typeScale.micro.desktop,
} as const;

// Status pill bg|fg|label rows — the single label source (Primitives reads it).
// Confidence reuses high/medium/low; urgency uses urgent/soon/routine.
export const statusPill: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: 'var(--vd-warn-bg)', fg: 'var(--vd-warn-fg)', label: 'Pending' },
  pending_review: { bg: 'var(--vd-warn-bg)', fg: 'var(--vd-warn-fg)', label: 'Pending review' },
  approved: { bg: 'var(--vd-ok-bg)', fg: 'var(--vd-ok-fg)', label: 'Approved' },
  changes: { bg: 'var(--vd-info-bg)', fg: 'var(--vd-info-fg)', label: 'Changes' },
  rejected: { bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)', label: 'Declined' },
  expired: { bg: 'var(--vd-neutral-bg)', fg: 'var(--vd-neutral-fg)', label: 'Expired' },
  high: { bg: 'var(--vd-ok-bg)', fg: 'var(--vd-ok-fg)', label: 'High' },
  medium: { bg: 'var(--vd-warn-bg)', fg: 'var(--vd-warn-fg)', label: 'Medium' },
  low: { bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)', label: 'Low' },
  urgent: { bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)', label: 'Urgent' },
  soon: { bg: 'var(--vd-warn-bg)', fg: 'var(--vd-warn-fg)', label: 'Soon' },
  routine: { bg: 'var(--vd-ok-bg)', fg: 'var(--vd-ok-fg)', label: 'Routine' },
};

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

// Liquid-glass skin for a small tinted label: the opaque token pair carries the
// contrast (DESIGN §2.1 forbids alpha-only tints, which collapse in dark), and
// a top-lit sheen, hairline border and inner highlight carry the material.
export function glassTint(bg: string, fg: string): Style {
  return {
    backgroundColor: bg,
    backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,255,255,0) 62%)',
    color: fg,
    border: '1px solid var(--vd-glass-border)',
    boxShadow: 'var(--vd-glass-hi), var(--vd-elev-1)',
  };
}

export function toneStyle(tone: Tone): Style {
  return glassTint(TONE_BG[tone], TONE_FG[tone]);
}

export function pillStyle(key: string, size = 11): Style {
  const p = statusPill[key] || statusPill.pending;
  return {
    fontSize: size, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase',
    padding: '3px 9px', borderRadius: radius.pill,
    ...glassTint(p.bg, p.fg),
  };
}

export const breakpoints = { tablet: 800, desktop: 1160 } as const;

// One z-scale for all overlays. Modals must always outrank the bottom nav:
// sticky < header < nav < sheet < catcher < popover < toast.
export const z = {
  sticky: 6,
  header: 10,
  nav: 40,
  sheet: 50,
  catcher: 55,
  popover: 60,
  toast: 70,
} as const;

// One breakpoint source for JS matchMedia and inline <style> blocks.
// Modules must not hand-write media queries.
export const media = {
  mobileOnly: `@media (max-width:${breakpoints.tablet - 0.02}px)`,
  tabletUp: `@media (min-width:${breakpoints.tablet}px)`,
  tabletOnly: `@media (min-width:${breakpoints.tablet}px) and (max-width:${breakpoints.desktop - 0.02}px)`,
  desktopUp: `@media (min-width:${breakpoints.desktop}px)`,
} as const;

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

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
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
  return t;
}
