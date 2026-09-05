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
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function backendName(): 'supabase' | 'local' {
  try {
    return lsGet('vd_supabase_url') && lsGet('vd_supabase_key') ? 'supabase' : 'local';
  } catch {
    return 'local';
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

export function recordEvent(log: any[] | undefined, ev: { consultId: string; actor: string; kind: string; detail: string }): any[] {
  const next = [...(log || []), { at: Date.now(), ...ev }];
  return next.slice(-200);
}
