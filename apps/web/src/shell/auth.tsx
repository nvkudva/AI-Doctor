import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clearLocal } from '../lib/api';

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
  googleConfigured: boolean;
  googlePending: boolean;
  authErr: string;
  signInGoogle: () => Promise<void>;
  signInDemo: (role: Role) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

const AUTH_KEY = 'vd_auth_v1';
// The session gate must never hold the loading skeleton hostage: if the auth
// host is slow or unreachable we fall back to the locally restored user.
const SESSION_TIMEOUT_MS = 4000;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
function supabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}

const DEMO_USERS: Record<Role, AuthUser> = {
  patient: { id: 'demo-patient', name: 'Alex Kumar', email: 'alex.kumar.demo@example.com', role: 'patient', provider: 'demo' },
  doctor: { id: 'demo-doctor', name: 'Dr. Sara Whitfield', email: 'sara.whitfield.demo@example.com', role: 'doctor', provider: 'demo' },
};

function toUser(id: string, email: string, meta: Record<string, unknown>): AuthUser {
  const role = meta.role === 'doctor' ? 'doctor' : 'patient';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => restore());
  const [ready, setReady] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const configured = !!supabase();

  useEffect(() => {
    const sb = supabase();
    if (!sb) {
      setReady(true);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };
    const timer = setTimeout(finish, SESSION_TIMEOUT_MS);
    sb.auth
      .getSession()
      .then(({ data }) => {
        const s = data.session?.user;
        if (s) {
          const u = toUser(s.id, s.email || '', (s.user_metadata || {}) as Record<string, unknown>);
          setUser(u);
          try {
            localStorage.setItem(AUTH_KEY, JSON.stringify(u));
          } catch { /* private mode */ }
        }
      })
      .catch(() => { /* offline or unreachable: keep the restored session */ })
      .finally(() => {
        clearTimeout(timer);
        finish();
      });
    const { data: sub } = sb.auth.onAuthStateChange((_ev, session) => {
      const s = session?.user;
      if (s) {
        const u = toUser(s.id, s.email || '', (s.user_metadata || {}) as Record<string, unknown>);
        setUser(u);
        try {
          localStorage.setItem(AUTH_KEY, JSON.stringify(u));
        } catch { /* private mode */ }
      }
    });
    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const persist = (u: AuthUser | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
      else localStorage.removeItem(AUTH_KEY);
    } catch { /* private mode */ }
  };

  const signInGoogle = async () => {
    setAuthErr('');
    const sb = supabase();
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

  const signInDemo = (role: Role) => {
    setAuthErr('');
    persist(DEMO_USERS[role]);
  };

  const signOut = () => {
    setAuthErr('');
    clearLocal();
    persist(null);
    supabase()?.auth.signOut();
  };

  return (
    <Ctx.Provider
      value={{ user, ready, googleConfigured: configured, googlePending, authErr, signInGoogle, signInDemo, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}
