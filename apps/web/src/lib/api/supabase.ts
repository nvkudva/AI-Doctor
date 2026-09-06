// The one place that knows Supabase exists. Everything above this file works
// against lib/api's typed calls; nothing above it imports @supabase/supabase-js.
//
// Only the project URL and the anon key live here. Both are public by design;
// a service-role key or a provider key must never reach this bundle.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

let client: SupabaseClient | null = null;

/** The single boundary flag. Absent env ⇒ the app runs on seeds + localStorage. */
export function hasSupabase(): boolean {
  return !!(URL && ANON_KEY);
}

export function supabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!client) client = createClient(URL, ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

/** Throws rather than returning null — for call sites already inside the live path. */
export function requireSupabase(): SupabaseClient {
  const sb = supabase();
  if (!sb) throw new Error('supabase_not_configured');
  return sb;
}

export function functionsBase(): string {
  return `${URL.replace(/\/$/, '')}/functions/v1`;
}

export function anonKey(): string {
  return ANON_KEY;
}
