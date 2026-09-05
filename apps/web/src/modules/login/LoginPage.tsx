// Login module: adult gate + Google / demo sign-in.
// One column on mobile; brand column + sign-in card at ≥800 (DESIGN §10.9).
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, Icon, MiraPresence } from '../../lib/ui';
import { useAuth, type Role } from '../../shell/auth';
import { useBreakpoint } from '../../shell/viewport';
import s from './LoginPage.module.css';

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

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <div className={s.brand}>
          <MiraPresence size={mobile ? 138 : bp === 'tablet' ? 152 : 184} />
          <div>
            <div className={s.name}>{hospitalName}</div>
            <div className={s.lede}>
              A calm, private doctor's visit — whenever you need one. Sign in to begin.
            </div>
          </div>
          {bp === 'desktop' && (
            <div className={s.trust}>
              {TRUST.map(line => (
                <div key={line} className={s.trustRow}>
                  <span className={s.trustIcon}><Icon name="check" size={18} /></span>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>

        <Card className={s.card}>
          <div
            onClick={() => { setAdultOk(a => !a); setErr(''); }}
            role="switch"
            aria-checked={adultOk}
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdultOk(a => !a); setErr(''); } }}
            aria-label="Confirm you are 18 or older"
            aria-invalid={!!err || undefined}
            aria-describedby={err || authErr ? 'vd-login-error' : undefined}
            className={`${s.gate}${adultOk ? ' ' + s.gateOn : ''}`}
          >
            <span className={`${s.track}${adultOk ? ' ' + s.trackOn : ''}`}>
              <span className={s.knob} />
            </span>
            <span>I confirm I am 18 or older</span>
          </div>

          {(err || authErr) && (
            <div id="vd-login-error" role="alert" className={s.error}>{err || authErr}</div>
          )}

          <Button
            variant="secondary"
            fullWidth
            onClick={google}
            disabled={googlePending}
            className={s.google}
          >
            <GoogleG />
            {googlePending ? 'Redirecting…' : 'Continue with Google'}
          </Button>

          {!googleConfigured && (
            <div className={s.demoNote}>
              Demo mode — add Supabase keys to enable real Google sign-in.
            </div>
          )}

          <div className={s.divider}>
            <span className={s.rule} />
            <span className={s.dividerLabel}>Demo accounts</span>
            <span className={s.rule} />
          </div>

          <div className={s.demos}>
            <DemoCard onClick={() => demo('patient')} label="Fake patient" who="Alex Kumar" />
            <DemoCard onClick={() => demo('doctor')} label="Fake doctor" who="Dr. Whitfield" />
          </div>

          <div className={s.footnote}>
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
      className={s.demoCard}
    >
      <span className={s.demoIcon}><Icon name="person" size={22} /></span>
      <span className={s.demoLabel}>{label}</span>
      <span className={s.demoWho}>{who}</span>
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
