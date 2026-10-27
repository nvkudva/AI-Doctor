import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearLocal } from '../lib/api/storage';
import { hasSupabase } from '../lib/api/env';

export type Role = 'patient' | 'doctor';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  provider: 'google' | 'demo';
}

interface AuthCtx {
  user: AuthUser | null;
  ready: boolean;
  /** Non-null only while a doctor has deliberately opted into another module's
   *  view. Session-scoped: a reload puts the doctor back on their own desk. */
  viewAs: Role | null;
  setViewAs: (r: Role | null) => void;
  googleConfigured: boolean;
  googlePending: boolean;
  authErr: string;
  signInGoogle: () => Promise<void>;
  signInDemo: (role: Role) => Promise<boolean>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

// The Supabase SDK is ~240 kB and nothing on the login screen's first paint
// needs it, so it is imported on demand rather than from the entry chunk. The
// promise is memoised: a sign-in click never pays for a second fetch, and the
// session effect below has already warmed it whenever a project is configured.
let sdk: Promise<typeof import('../lib/api/supabase')> | null = null;
function loadSdk() {
  if (!sdk) sdk = import('../lib/api/supabase');
  return sdk;
}

const AUTH_KEY = 'vd_auth_v1';
// The session gate must never hold the loading skeleton hostage: if the auth
// host is slow or unreachable we fall back to the locally restored user.
const SESSION_TIMEOUT_MS = 4000;
// The seeded demo accounts (supabase/README.md). The password is never in this
// source: with no VITE_DEMO_PASSWORD the demo buttons stay local-only.
const DEMO_PASSWORD = (import.meta.env.VITE_DEMO_PASSWORD as string | undefined) || '';

const DEMO_USERS: Record<Role, AuthUser> = {
  patient: { id: 'demo-patient', name: 'Alex Kumar', email: 'alex.kumar.demo@example.com', role: 'patient', provider: 'demo' },
  doctor: { id: 'demo-doctor', name: 'Dr. Sara Whitfield', email: 'sara.whitfield.demo@example.com', role: 'doctor', provider: 'demo' },
};

// The authoritative role lives in public.memberships — role assignment is
// never client-writable (migration 0002), so the auth user's metadata does not
// carry it. `kind` is the closest hint the seeded metadata has; it decides only
// which module paints while resolveRole() is in flight.
function toUser(id: string, email: string, meta: Record<string, unknown>): AuthUser {
  const role: Role = meta.role === 'doctor' || meta.kind === 'clinician' ? 'doctor' : 'patient';
  const name =
    (meta.full_name as string) || (meta.name as string) || (email ? email.split('@')[0] : role === 'doctor' ? 'Doctor' : 'Patient');
  return { id, name, email, role, provider: 'google' };
}

function restore(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// Ask the database who this account is. Without it a clinician whose metadata
// says nothing lands in the patient module under their own name, with no route
// back to the review desk (DESIGN-REVIEW D1).
async function resolveRole(fallback: Role): Promise<Role> {
  try {
    const { myMemberships } = await import('../lib/api/client');
    const rows = await myMemberships();
    if (!rows.length) return fallback;
    return rows.some(m => m.role === 'doctor' || m.role === 'admin') ? 'doctor' : 'patient';
  } catch {
    return fallback; // offline, or memberships unreachable — the hint stands
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => restore());
  const [ready, setReady] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [viewAs, setViewAs] = useState<Role | null>(null);
  const configured = hasSupabase();

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    let settled = false;
    let live = true;
    let unsubscribe: (() => void) | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };
    // The timer starts before the SDK fetch, so a slow chunk cannot hold the
    // skeleton past SESSION_TIMEOUT_MS any more than a slow auth host could.
    const timer = setTimeout(finish, SESSION_TIMEOUT_MS);
    // One path for the restored session and every later auth event: paint what
    // the metadata claims, then correct the role from memberships. Without the
    // correction the second step silently demoted a doctor to a patient.
    const adopt = (s: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
      const u = toUser(s.id, s.email || '', s.user_metadata || {});
      persist(u);
      void resolveRole(u.role).then((role) => {
        if (live && role !== u.role) persist({ ...u, role });
      });
    };
    void loadSdk().then(({ supabase }) => {
      const sb = supabase();
      if (!sb || !live) {
        finish();
        return;
      }
      sb.auth
        .getSession()
        .then(({ data }) => {
          if (data.session?.user) adopt(data.session.user);
          // A resolved "no session" is authoritative: the stored user is
          // stale or forged and must not keep role routes open (QA P1).
          else persist(null);
        })
        .catch(() => { /* offline or unreachable: keep the restored session */ })
        .finally(() => {
          clearTimeout(timer);
          finish();
        });
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        if (session?.user) adopt(session.user);
        else if (event === 'SIGNED_OUT') persist(null);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      if (!live) unsubscribe();
    }).catch(finish);
    return () => {
      live = false;
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [configured]);

  const persist = (u: AuthUser | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
      else localStorage.removeItem(AUTH_KEY);
    } catch { /* private mode */ }
  };

  // A borrowed view belongs to one session of one account: signing out, or a
  // different account arriving, puts the shell back on that account's own module.
  const uid = user?.id;
  useEffect(() => { setViewAs(null); }, [uid]);

  const signInGoogle = async () => {
    setAuthErr('');
    const sb = configured ? (await loadSdk()).supabase() : null;
    if (!sb) {
      persist({ id: 'google-demo', name: 'Alex Kumar', email: 'alex.kumar@gmail.com', role: 'patient', provider: 'google' });
      return;
    }
    setGooglePending(true);
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + '/patient' },
    });
    setGooglePending(false);
    if (error) setAuthErr(error.message);
  };

  // With a project configured the demo buttons sign in as the seeded accounts,
  // so the app runs on real rows under real RLS. Without one they are exactly
  // what they always were: a local user over the seeds.
  const signInDemo = async (role: Role): Promise<boolean> => {
    setAuthErr('');
    if (!configured || !DEMO_PASSWORD) {
      persist(DEMO_USERS[role]);
      return true;
    }
    setGooglePending(true);
    try {
      const { supabase } = await loadSdk();
      const sb = supabase();
      if (!sb) {
        persist(DEMO_USERS[role]);
        return true;
      }
      const { data, error } = await sb.auth.signInWithPassword({
        email: DEMO_USERS[role].email, password: DEMO_PASSWORD,
      });
      if (error || !data.user) {
        setAuthErr(error?.message || 'Could not sign in to the demo account');
        return false;
      }
      const meta = { ...(data.user.user_metadata || {}), role } as Record<string, unknown>;
      persist({ ...toUser(data.user.id, data.user.email || '', meta), role, provider: 'demo' });
      return true;
    } catch {
      setAuthErr('Could not sign in to the demo account');
      return false;
    } finally {
      setGooglePending(false);
    }
  };

  const signOut = () => {
    setAuthErr('');
    clearLocal();
    persist(null);
    if (!configured) return;
    // Both live behind the SDK boundary; the local session is already gone, so
    // clearing the server session and the cached hospital id can settle late.
    void loadSdk().then(({ supabase }) => supabase()?.auth.signOut());
    void import('../lib/api/client').then(({ forgetHospitalId }) => forgetHospitalId());
  };

  return (
    <Ctx.Provider
      value={{
        user, ready, viewAs, setViewAs,
        googleConfigured: configured, googlePending, authErr, signInGoogle, signInDemo, signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
