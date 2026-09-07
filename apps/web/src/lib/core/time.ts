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

// The review target the desk is judged against (DATA-MODEL §3.5): a 2h nudge
// and a 24h expiry. The countdown is what a doctor reads on a row — how long
// is left, not how long it has been.
export const SLA_TARGET_MIN = 120;
export const SLA_EXPIRY_MIN = 24 * 60;

export interface Sla {
  /** Minutes left before the 2h target; negative once it has passed. */
  left: number;
  breached: boolean;
  /** True inside the last 20 minutes before the target. */
  closing: boolean;
  label: string;
  tone: string;
}

export function slaCountdown(submittedAt: number, now = Date.now()): Sla {
  const left = SLA_TARGET_MIN - Math.floor((now - submittedAt) / 60000);
  const breached = left <= 0;
  const closing = !breached && left <= 20;
  return {
    left,
    breached,
    closing,
    label: breached ? `target passed ${span(-left)} ago` : `${span(left)} to target`,
    tone: breached ? 'var(--vd-bad-fg)' : closing ? 'var(--vd-warn-fg)' : 'var(--vd-ink-4)',
  };
}

function span(min: number): string {
  const m = Math.max(1, min);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
