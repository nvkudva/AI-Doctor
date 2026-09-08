// The one place that knows Supabase exists. Everything above this file works
// against lib/api's typed calls; nothing above it imports @supabase/supabase-js.
//
// This module is the SDK boundary and is imported dynamically by the shell, so
// the entry chunk stays free of it. The project's URL and key live in env.ts,
// which is safe to import eagerly.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { anonKey, hasSupabase, projectUrl } from './env';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!client) client = createClient(projectUrl(), anonKey(), { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

/** Throws rather than returning null — for call sites already inside the live path. */
export function requireSupabase(): SupabaseClient {
  const sb = supabase();
  if (!sb) throw new Error('supabase_not_configured');
  return sb;
}
