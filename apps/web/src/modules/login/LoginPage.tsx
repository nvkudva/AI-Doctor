// Login module: adult gate + Google / demo sign-in.
// One column on mobile; brand column + sign-in card at ≥800 (DESIGN §10.9).
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, Icon, MiraPresence } from '../../lib/ui';
import { elevation, gradients, ink, lines, media, radius, surfaces, type } from '../../lib/theme';
import { useAuth, type Role } from '../../shell/auth';
import { useBreakpoint } from '../../shell/viewport';

const TRUST = [
  'A licensed doctor reviews every plan',
  'Your visit notes stay private to you',
  'No forms — just talk to Dr. Mira',
];

export function LoginPage({ hospitalName }: { hospitalName: string }) {
  const { signInGoogle, signInDemo, googleConfigured, googlePending, authErr } = useAuth();
  const nav = useNavigate();
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
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

  const brandName = mobile ? type.display : bp === 'tablet' ? type.displayT : type.displayD;
  const callout = mobile ? type.callout : type.calloutT;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center', background: gradients.app }}>
      <style>{`
        ${media.tabletUp}{
          .vd-login{width:min(900px,100%)!important;display:grid!important;grid-template-columns:minmax(0,1fr) 420px;gap:48px;align-items:center;text-align:left!important;padding:40px 32px!important}
          .vd-login-brand{align-items:flex-start!important;text-align:left!important}
          .vd-login-card{width:100%!important}
        }
        ${media.desktopUp}{
          .vd-login{width:min(1080px,100%)!important;grid-template-columns:minmax(0,1fr) 440px;gap:64px}
        }
      `}</style>

      <div className="vd-login" style={{ width: 'min(420px,100%)', margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 40px', textAlign: 'center' }}>
        <div className="vd-login-brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, marginBottom: 28 }}>
          <MiraPresence size={mobile ? 138 : bp === 'tablet' ? 152 : 184} />
          <div>
            <div style={{ ...brandName, color: ink.primary }}>{hospitalName}</div>
            <div style={{ ...(mobile ? type.callout : type.bodyT), color: ink.soft, marginTop: 12, maxWidth: 320 }}>
              A calm, private doctor's visit — whenever you need one. Sign in to begin.
            </div>
          </div>
          {bp === 'desktop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TRUST.map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, ...type.calloutD, color: ink.body }}>
                  <span style={{ flex: 'none', display: 'flex', color: 'var(--vd-ok-fg)' }}><Icon name="check" size={18} /></span>
                  {t}
                </div>
              ))}
            </div>
          )}
        </div>

        <Card
          className="vd-login-card"
          level={mobile ? 0 : 3}
          bordered={!mobile}
          pad={mobile ? 0 : bp === 'tablet' ? 28 : 32}
          style={{
            width: '100%', textAlign: 'left',
            background: mobile ? 'transparent' : surfaces.card,
            borderRadius: radius.xl,
          }}
        >
          <div
            onClick={() => { setAdultOk(a => !a); setErr(''); }}
            role="switch"
            aria-checked={adultOk}
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdultOk(a => !a); setErr(''); } }}
            aria-label="Confirm you are 18 or older"
            style={{
              cursor: 'pointer', width: '100%', height: 56, boxSizing: 'border-box', borderRadius: radius.md,
              background: surfaces.card, border: `1.5px solid ${adultOk ? ink.primary : lines.strong}`,
              display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
              ...type.subhead, color: ink.primary, marginBottom: 12,
            }}
          >
            <span style={{ width: 38, height: 23, borderRadius: radius.pill, background: adultOk ? ink.primary : lines.strong, display: 'inline-flex', alignItems: 'center', padding: 2, justifyContent: adultOk ? 'flex-end' : 'flex-start', flex: 'none', transition: 'background var(--vd-dur-2) var(--vd-ease-spring)' }}>
              <span style={{ width: 19, height: 19, borderRadius: '50%', background: surfaces.card }} />
            </span>
            <span>I confirm I am 18 or older</span>
          </div>

          {(err || authErr) && <div style={{ ...type.footnote, fontWeight: 600, color: 'var(--vd-bad-fg)', marginBottom: 10 }}>{err || authErr}</div>}

          <Button
            variant="secondary"
            fullWidth
            onClick={google}
            disabled={googlePending}
            style={{ background: surfaces.card, border: `1px solid ${lines.hairline}`, boxShadow: elevation[2], gap: 11 }}
          >
            <GoogleG />
            {googlePending ? 'Redirecting…' : 'Continue with Google'}
          </Button>

          {!googleConfigured && (
            <div style={{ ...type.footnote, color: ink.soft, marginTop: 10 }}>
              Demo mode — add Supabase keys to enable real Google sign-in.
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 14px' }}>
            <span style={{ flex: 1, height: 1, background: lines.strong }} />
            <span style={{ ...type.micro, letterSpacing: '.06em', color: ink.soft }}>Demo accounts</span>
            <span style={{ flex: 1, height: 1, background: lines.strong }} />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <DemoCard onClick={() => demo('patient')} label="Fake patient" who="Alex Kumar" />
            <DemoCard onClick={() => demo('doctor')} label="Fake doctor" who="Dr. Whitfield" />
          </div>

          <div style={{ ...callout, color: ink.soft, marginTop: 16 }}>
            One tap to sign in — your visits stay private and a licensed doctor reviews every plan.
          </div>
        </Card>
      </div>
    </div>
  );
}

function DemoCard({ onClick, label, who }: { onClick: () => void; label: string; who: string }) {
  return (
    <Card
      onClick={onClick}
      pad="14px 10px"
      style={{ flex: 1, minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}
    >
      <span style={{ display: 'flex', color: ink.primary }}><Icon name="person" size={22} /></span>
      <span style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>{label}</span>
      <span style={{ ...type.footnote, color: ink.secondary }}>{who}</span>
    </Card>
  );
}

// Google's brand mark — fixed brand colours, not themeable.
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
