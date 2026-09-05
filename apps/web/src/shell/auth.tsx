import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Icon, MiraPresence, pressProps } from '@vd/ui';
import { gradients, ink, surfaces } from '@vd/theme';

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
    sb.auth.getSession().then(({ data }) => {
      const s = data.session?.user;
      if (s) {
        const u = toUser(s.id, s.email || '', (s.user_metadata || {}) as Record<string, unknown>);
        setUser(u);
        try {
          localStorage.setItem(AUTH_KEY, JSON.stringify(u));
        } catch { /* private mode */ }
      }
      setReady(true);
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
    return () => sub.subscription.unsubscribe();
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

export function go(path: string) {
  history.replaceState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function LoginPage({ hospitalName }: { hospitalName: string }) {
  const { signInGoogle, signInDemo, googleConfigured, googlePending, authErr } = useAuth();
  const [adultOk, setAdultOk] = useState(false);
  const [err, setErr] = useState('');

  const gate = () => {
    if (!adultOk) {
      setErr('This service is for adults (18+). Please confirm to continue.');
      return false;
    }
    setErr('');
    return true;
  };

  const demo = (role: Role) => {
    if (!gate()) return;
    signInDemo(role);
    go(role === 'doctor' ? '/doctor' : '/patient');
  };

  const google = async () => {
    if (!gate()) return;
    await signInGoogle();
    if (!SUPABASE_URL) go('/patient');
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center', background: gradients.app }}>
      <div style={{ width: 'min(560px,100%)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '66px 26px 40px', textAlign: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, minHeight: 0 }}>
          <MiraPresence size={138} />
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, color: ink.primary }}>{hospitalName}</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: ink.soft, marginTop: 12, maxWidth: 300 }}>
              A calm, private doctor's visit — whenever you need one. Sign in to begin.
            </div>
          </div>
        </div>
        <div style={{ width: '100%' }}>
          <div
            onClick={() => { setAdultOk(a => !a); setErr(''); }}
            role="switch"
            aria-checked={adultOk}
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdultOk(a => !a); setErr(''); } }}
            aria-label="Confirm you are 18 or older"
            style={{ cursor: 'pointer', width: '100%', borderRadius: 16, background: 'rgba(255,255,255,.55)', border: `1.5px solid ${adultOk ? ink.primary : 'rgba(36,27,69,.25)'}`, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', fontSize: 13.5, fontWeight: 600, color: ink.primary, marginBottom: 12 }}
          >
            <span style={{ width: 38, height: 23, borderRadius: 99, background: adultOk ? ink.primary : 'rgba(36,27,69,.25)', display: 'inline-flex', alignItems: 'center', padding: 2, justifyContent: adultOk ? 'flex-end' : 'flex-start', flex: 'none', transition: 'background .2s var(--vd-spring)' }}>
              <span style={{ width: 19, height: 19, borderRadius: '50%', background: 'var(--vd-surface-card)' }} />
            </span>
            <span style={{ textAlign: 'left' }}>I confirm I am 18 or older</span>
          </div>
          {(err || authErr) && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--vd-bad-fg)', marginBottom: 10 }}>{err || authErr}</div>}
          <div {...pressProps(google, 'Continue with Google')} style={{ cursor: 'pointer', width: '100%', height: 48, borderRadius: 99, background: surfaces.card, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, fontSize: 15, fontWeight: 700, color: ink.primary, boxShadow: '0 10px 26px rgba(46,37,71,.25)', opacity: googlePending ? 0.7 : 1 }}>
            <GoogleG />
            {googlePending ? 'Redirecting…' : 'Continue with Google'}
          </div>
          {!googleConfigured && (
            <div style={{ fontSize: 12, color: ink.soft, marginTop: 10, lineHeight: 1.5 }}>
              Demo mode — add Supabase keys to enable real Google sign-in.
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 14px' }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(36,27,69,.2)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: ink.soft }}>Demo accounts</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(36,27,69,.2)' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div {...pressProps(() => demo('patient'), 'Sign in as demo patient Alex Kumar')} style={demoBtn}>
              <span style={{ display: 'flex', color: ink.primary }}><Icon name="person" size={22} /></span>
              <span>Fake patient</span>
              <small style={{ fontWeight: 500, opacity: 0.7 }}>Alex Kumar</small>
            </div>
            <div {...pressProps(() => demo('doctor'), 'Sign in as demo doctor Dr. Whitfield')} style={demoBtn}>
              <span style={{ display: 'flex', color: ink.primary }}><Icon name="person" size={22} /></span>
              <span>Fake doctor</span>
              <small style={{ fontWeight: 500, opacity: 0.7 }}>Dr. Whitfield</small>
            </div>
          </div>
          <div style={{ fontSize: 12, color: ink.soft, marginTop: 16, lineHeight: 1.5 }}>One tap to sign in — your visits stay private and a licensed doctor reviews every plan.</div>
        </div>
      </div>
    </div>
  );
}

const demoBtn = {
  cursor: 'pointer', flex: 1, borderRadius: 16, background: surfaces.card,
  border: '1px solid rgba(36,27,69,.12)', display: 'flex', flexDirection: 'column' as const,
  alignItems: 'center', gap: 4, padding: '14px 10px', fontSize: 14, fontWeight: 700, color: ink.primary,
  boxShadow: '0 10px 24px rgba(46,37,71,.18)',
};

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.4 7.5 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.5-2.7-.1.1C.6 8.7 0 10.2 0 12s.6 3.3 1.6 4.8l3.6-2.4z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.6 1.6 6.8l3.6 2.9c.9-2.9 3.6-5 6.8-5z" />
    </svg>
  );
}
