// Backend seam (ARCH: Supabase Auth + Postgres + Realtime, ai-consult Edge Function).
// Default is the local store. To connect Supabase, set vd_supabase_url and
// vd_supabase_key in localStorage, then mirror the same payload shapes here
// into consults / reviews / consult_events — no caller changes needed.
import { loadLocal, saveLocal } from './store.js';

export function isSupabase() {
  try {
    return !!(localStorage.getItem('vd_supabase_url') && localStorage.getItem('vd_supabase_key'));
  } catch (e) { return false; }
}

export function backendName() {
  return isSupabase() ? 'supabase' : 'local';
}

export function restore() {
  return loadLocal();
}

export function persist(patch) {
  const next = { ...(loadLocal() || {}), ...patch };
  saveLocal(next);
  return next;
}
