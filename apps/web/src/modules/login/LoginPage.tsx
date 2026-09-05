// Login module: adult gate + Google / demo sign-in.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon, MiraPresence, pressProps } from '../../lib/ui';
import { gradients, ink, surfaces } from '../../lib/theme';
import { useAuth, type Role } from '../../shell/auth';

export function LoginPage({ hospitalName }: { hospitalName: string }) {
  const { signInGoogle, signInDemo, googleConfigured, googlePending, authErr } = useAuth();
  const nav = useNavigate();
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
    nav(role === 'doctor' ? '/doctor' : '/patient');
  };

  const google = async () => {
    if (!gate()) return;
    await signInGoogle();
    if (!googleConfigured) nav('/patient');
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
