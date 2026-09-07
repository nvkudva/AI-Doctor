// The dose schedule. `prescription_items` records what was prescribed and how
// often — never the clock times, and never whether anything was swallowed. So
// the times are read out of the prescription's own timing text against a fixed
// convention, and the ticks live in localStorage until a schedule table exists.
import type { CaseItem, CheckIn, Dose, UserRx } from './types';

// Morning, evening, night — the three slots almost every oral regimen lands on.
const ONCE = [9];
const TWICE = [8, 20];
const THRICE = [8, 14, 20];
const NIGHT = [21];

export function doseHours(timing: string): number[] {
  const t = timing.toLowerCase();
  if (/\b(tds|tid)\b|three times|3 times|thrice/.test(t)) return THRICE;
  if (/\b(bd|bid)\b|twice|two times|2 times/.test(t)) return TWICE;
  if (/night|bedtime|nocte/.test(t)) return NIGHT;
  if (/as needed|prn|when required/.test(t)) return [];
  return ONCE;
}

export function buildSchedule(rx: UserRx[], taken: Record<string, boolean>, days = 2, now = Date.now()): Dose[] {
  const out: Dose[] = [];
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  rx.forEach((r, i) => {
    const hours = doseHours(r.detail || '');
    for (let d = 0; d < days; d++) {
      for (const h of hours) {
        const at = midnight.getTime() + d * 86400000 + h * 3600000;
        const id = `${i}:${d}:${h}`;
        out.push({ id, rx: r.name, detail: r.detail || '', at, taken: !!taken[id] });
      }
    }
  });
  return out.sort((a, b) => a.at - b.at);
}

export type DoseState = 'taken' | 'missed' | 'due' | 'later';

// "Due" is the window a person can actually act in: from the dose time until an
// hour past it. Before that it is not yet theirs to take; after, it was missed.
export function doseState(d: Dose, now = Date.now()): DoseState {
  if (d.taken) return 'taken';
  if (now > d.at + 3600000) return 'missed';
  if (now >= d.at - 30 * 60000) return 'due';
  return 'later';
}

// The day-3 nudge: the newest approved plan at least three days old that has
// not been answered yet. Anything sooner is not a check-in, it is a poke.
const CHECK_IN_AFTER = 3 * 86400000;

export function pendingCheckIn(queue: CaseItem[], answered: Record<string, string>, now = Date.now()): CheckIn | null {
  const due = queue
    .filter(c => c.mine && c.status === 'approved' && c.reviewedAt && !answered[c.id])
    .filter(c => now - (c.reviewedAt || 0) >= CHECK_IN_AFTER)
    .sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0))[0];
  return due ? { consultId: due.id, title: due.rec.title || due.title, approvedAt: due.reviewedAt || 0 } : null;
}
