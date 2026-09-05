// Design tokens: thin TS aliases over theme.css variables (single source of
// truth). Every value resolves per data-theme, so components get light + dark
// free. Import '@vd/theme/theme.css' once (apps/web/src/main.tsx does).

export const ink = {
  primary: 'var(--vd-ink-1)',
  body: 'var(--vd-ink-2)',
  secondary: 'var(--vd-ink-3)',
  soft: 'var(--vd-ink-soft)',
  muted: 'var(--vd-ink-4)',
  onGlass: 'var(--vd-accent-ink)',
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
  bubbleMine: 'var(--vd-surface-mine)',
  caseHeader: 'var(--vd-case-header)',
};

export const nav = {
  active: 'var(--vd-nav-active)',
  muted: 'var(--vd-ink-4)',
};

export const radius = { sm: 9, card: 16, panel: 22, dock: 26, pill: 99 } as const;

export const shadows = {
  chip: '0 3px 12px rgba(12,20,60,.22)',
  card: '0 14px 34px rgba(12,20,60,.32)',
  cta: '0 12px 30px oklch(0.42 0.2 290 / .55)',
  popover: '0 20px 50px rgba(12,20,60,.4)',
};

export const font = {
  family: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif`,
  micro: '11px',
};

// One control metric: every rectangular button is 48 high and fully pill;
// circular icon buttons are 44; compact bar chips are 38.
export const control = {
  btn: 48,
  icon: 44,
  compact: 38,
} as const;

// Apple text styles: [size, weight]. Use everywhere instead of ad-hoc sizes.
export const type = {
  largeTitle: { fontSize: 26, fontWeight: 700 },
  title: { fontSize: 20, fontWeight: 700 },
  headline: { fontSize: 16, fontWeight: 700 },
  body: { fontSize: 14, fontWeight: 400 },
  callout: { fontSize: 13, fontWeight: 400 },
  footnote: { fontSize: 12, fontWeight: 400 },
  caption: { fontSize: 11, fontWeight: 600 },
  micro: { fontSize: 11, fontWeight: 700 },
} as const;

// Status pill bg|fg pairs. Confidence reuses high/medium/low rows.
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
};

export type Style = Record<string, string | number>;

export function pillStyle(key: string, size = 11): Style {
  const p = statusPill[key] || statusPill.pending;
  return {
    fontSize: size, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase',
    padding: '3px 9px', borderRadius: radius.pill, background: p.bg, color: p.fg,
  };
}

export const breakpoints = { tablet: 800, desktop: 1160 } as const;

// One z-scale for all overlays: header < sheet < catcher < popover < nav < toast.
export const z = {
  sticky: 6,
  header: 10,
  sheet: 20,
  catcher: 25,
  popover: 30,
  nav: 40,
  toast: 60,
} as const;

// One breakpoint source for JS matchMedia and inline <style> blocks.
export const media = {
  tabletUp: `@media (min-width:${breakpoints.tablet}px)`,
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
