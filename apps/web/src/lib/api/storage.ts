// ---------------------------------------------------------------------------
// Local consult store (PRD table shapes). Supabase mirrors these payloads
// into consults / reviews / consult_events once keys are configured.
// ---------------------------------------------------------------------------

const STATE_KEY = 'vd_state_v1';

export interface LocalSnapshot {
  liveQueue?: any[];
  consultsAdd?: any[];
  rxAdd?: any[];
  events?: any[];
  /** The patient's editable health profile — the only clinical facts the app
   *  may assert about them (UX-25). */
  profile?: { age: string; blood: string; allergies: string } | null;
  /** A consult still in progress. Cleared when it completes or is reset, so a
   *  leftover one means the patient walked away mid-visit (UX-15). */
  draftConsult?: { messages: any[]; at: number } | null;
  /** Dismissed-or-not notification list, so a dismissal survives reload (QA-05). */
  notices?: any[];
  /** Review decisions keyed by case id, including decisions on seeded cases,
   *  so a doctor never re-reviews a case they already signed (UX-02). */
  decisions?: Record<string, ReviewDecision>;
  /** Doses ticked off, keyed by dose id. The schema records what was
   *  prescribed, not what was swallowed. */
  doses?: Record<string, boolean>;
  /** Answers to the day-3 check-in, keyed by consult id. */
  checkIns?: Record<string, string>;
  /** Test slots the patient booked from a plan, until booking has a backend. */
  booked?: any[];
}

export interface ReviewDecision {
  status: string; decision: string; reviewedBy: string; reviewedAt: number; rejectReason?: string;
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function restoreLocal(): LocalSnapshot | null {
  try {
    const raw = lsGet(STATE_KEY);
    return raw ? (JSON.parse(raw) as LocalSnapshot) : null;
  } catch {
    return null;
  }
}

export function persistLocal(patch: LocalSnapshot): LocalSnapshot {
  const next = { ...(restoreLocal() || {}), ...patch };
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch { /* storage unavailable — records stay in memory */ }
  return next;
}

// Sign-out must not leave one account's clinical snapshot on the device for
// the next person who signs in on the same browser (QA-02).
export function clearLocal(): void {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch { /* storage unavailable */ }
}

export function recordEvent(log: any[] | undefined, ev: { consultId: string; actor: string; kind: string; detail: string }): any[] {
  const next = [...(log || []), { at: Date.now(), ...ev }];
  return next.slice(-200);
}
