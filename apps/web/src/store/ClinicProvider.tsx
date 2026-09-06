// The boundary. One decision, made once: with a Supabase project configured the
// store is backed by the §4 API; without one the app runs exactly as it did
// before the backend existed, on seeds and localStorage.
//
// No screen below this point knows which of the two it is talking to.
import type { ReactNode } from 'react';
import { hasSupabase } from '../lib/api';
import { LocalClinic } from './LocalClinic';
import { SupabaseClinic } from './SupabaseClinic';
import type { ClinicSeeds } from './types';

export { useClinic } from './context';

export function ClinicProvider(props: ClinicSeeds & { children: ReactNode }) {
  return hasSupabase() ? <SupabaseClinic {...props} /> : <LocalClinic {...props} />;
}
