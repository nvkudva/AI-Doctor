// The Supabase project's public coordinates, and nothing else. Split out of
// supabase.ts so that asking "is there a backend?" — which the shell does on
// every first paint — does not pull the ~240 kB SDK into the entry chunk.
//
// Only these two values ever belong here. Both are public by design; a
// service-role key or a provider key must never reach this bundle.
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

/** The single boundary flag. Absent env ⇒ the app runs on seeds + localStorage. */
export function hasSupabase(): boolean {
  return !!(URL && ANON_KEY);
}

export function projectUrl(): string {
  return URL;
}

export function functionsBase(): string {
  return `${URL.replace(/\/$/, '')}/functions/v1`;
}

export function anonKey(): string {
  return ANON_KEY;
}
