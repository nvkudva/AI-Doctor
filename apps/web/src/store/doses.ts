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

/** A booked test or a diet plan is a prescription item, but it is not a dose:
 *  only something with a dosage belongs on a schedule of what to take, when. */
function isDosed(r: UserRx): boolean {
  return !!(r.dosage && r.dosage.trim());
}

export function buildSchedule(rx: UserRx[], taken: Record<string, boolean>, days = 2, now = Date.now()): Dose[] {
  const out: Dose[] = [];
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  rx.filter(isDosed).forEach((r, i) => {
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
// Past this, the plan is history rather than treatment in progress.
const CHECK_IN_WINDOW = 21 * 86400000;

export function pendingCheckIn(queue: CaseItem[], answered: Record<string, string>, now = Date.now()): CheckIn | null {
  // Only plans still being followed: a consult approved months ago is history,
  // not something to nag about, and listing all of them turns the check-in
  // into a survey the patient will dismiss.
  const all = queue
    .filter(c => c.mine && c.status === 'approved' && c.reviewedAt && !answered[c.id])
    .filter(c => {
      const since = now - (c.reviewedAt || 0);
      return since >= CHECK_IN_AFTER && since <= CHECK_IN_WINDOW;
    })
    .sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0))
    .slice(0, 3);
  const due = all[0];
  if (!due) return null;
  // The condition and the plan name both come off the same case, so the sheet
  // can never ask about one plan while home advertises another (D8).
  const name = (c: typeof due) => {
    const plan = c.rec.title || c.title;
    const condition = (c.inferred || [])[0] || c.title;
    // The plan line is dropped when it only repeats the condition.
    return { id: c.id, title: condition, plan: plan === condition ? '' : plan };
  };
  const head = name(due);
  return {
    consultId: due.id,
    title: head.title,
    plan: head.plan,
    approvedAt: due.reviewedAt || 0,
    alternatives: all.slice(1).map(name),
  };
}
