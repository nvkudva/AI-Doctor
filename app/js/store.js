// Local persistence, shaped like the PRD core tables (consults, reviews, consult_events).
// Callers never touch localStorage directly — see backend.js for the swap path.
const KEY = 'vd_state_v1';

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function saveLocal(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

// Append an audit event {at, consultId, actor, kind, detail}; keeps the last 200.
export function recordEvent(log, ev) {
  const next = [...(log || []), { at: Date.now(), ...ev }];
  return next.slice(-200);
}
