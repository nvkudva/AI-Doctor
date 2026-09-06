// The seam. Screens read this context and nothing else; which implementation
// fills it is decided once, in ClinicProvider.
import { createContext, useContext } from 'react';
import type { Clinic } from './types';

export const Ctx = createContext<Clinic | null>(null);

export function useClinic(): Clinic {
  const v = useContext(Ctx);
  if (!v) throw new Error('useClinic outside ClinicProvider');
  return v;
}
