import { AccountMenu, Icon, MiraPresence, pressProps } from '../../../lib/ui';
import { gradients, ink, media, type } from '../../../lib/theme';
import { useAuth } from '../../../shell/auth';

function daypart(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function HomeScreen({ onStart }: { onStart: () => void }) {
  const { user } = useAuth();
  const first = (user?.name || 'Alex Kumar').replace(/^Dr\.\s*/, '').split(' ')[0] || 'there';
  return (
    <div className="vd-scroll vd-home" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 20px 118px' }}>
      <style>{`${media.tabletUp}{.vd-home{max-width:960px;margin:0 auto;width:100%}.vd-home-grid{display:flex;gap:28px;align-items:center;justify-content:center;flex:1;width:100%}.vd-home-hero{flex:1.2;min-width:0}.vd-home-side{display:flex!important}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ ...type.largeTitle, color: ink.primary, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{daypart()}, {first}</div>
        <AccountMenu name={user?.name || 'Alex Kumar'} detail={user?.email || 'alex.kumar@gmail.com'} />
      </div>
      <div className="vd-home-grid">
      <div className="vd-home-hero" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center', padding: '12px 0' }}>
        <MiraPresence size={152} />
        <div>
          <div style={{ ...type.headline, color: ink.primary }}>Dr. Mira is ready</div>
          <div style={{ ...type.body, lineHeight: 1.55, color: ink.soft, marginTop: 8, maxWidth: 270 }}>
            Start a consult and just talk — no forms.
          </div>
        </div>
        <div
          {...pressProps(onStart, 'Start consultation')}
          style={{
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 28px',
            borderRadius: 99, background: gradients.primary, color: 'var(--vd-ink-on-brand)', fontSize: 15, fontWeight: 700,
            boxShadow: 'var(--vd-shadow-cta)',
          }}
        >
          <Icon name="mic" size={19} /> Start consultation
        </div>
      </div>
      <aside className="vd-home-side" aria-label="How it works" style={{ display: 'none', flexDirection: 'column', gap: 12, flex: '1 1 280px', maxWidth: 340 }}>
        <div style={{ background: 'var(--vd-surface-card)', border: '1px solid var(--vd-glass-border)', borderRadius: 20, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--vd-ink-3)' }}>How a visit works</div>
          {['Talk with Dr. Mira — no forms', 'A doctor reviews your plan', 'Confirmed plan lands in History'].map((s, i) => (
            <div key={s} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--vd-ink-2)' }}>
              <span style={{ flex: 'none', width: 22, height: 22, borderRadius: 99, background: gradients.primary, color: 'var(--vd-ink-on-brand)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              {s}
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--vd-surface-card)', border: '1px solid var(--vd-glass-border)', borderRadius: 20, padding: '16px 18px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--vd-ink-2)' }}>
          Usual review wait is under an hour. If symptoms worsen, seek urgent care right away.
        </div>
      </aside>
      </div>
    </div>
  );
}
