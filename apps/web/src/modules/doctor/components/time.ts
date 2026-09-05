// Relative-time helpers for queue wait labels and notification ages.
export function relAge(at: number): string {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function waitMinutes(submittedAt: number): number {
  return Math.max(0, Math.round((Date.now() - submittedAt) / 60000));
}

export function waitTone(submittedAt: number): string {
  const m = waitMinutes(submittedAt);
  return m > 120 ? 'var(--vd-bad-fg)' : m > 30 ? 'var(--vd-warn-fg)' : 'var(--vd-ink-4)';
}

export function waitAge(submittedAt: number): string {
  const m = Math.max(1, Math.round((Date.now() - submittedAt) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
