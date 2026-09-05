// Patient home: greeting header, Mira hero, and a right rail at ≥800.
import { AppHeader, Button, Card, MiraPresence, StatusPill, bottomBarInset, greeting } from '../../../lib/ui';
import { PatientNotify } from './PatientNotify';
import { gradients, ink, media, radius, type } from '../../../lib/theme';
import { useAuth } from '../../../shell/auth';
import { useBreakpoint } from '../../../shell/viewport';
import { useClinic } from '../../../store';

const STEPS = ['Talk with Dr. Mira — no forms', 'A doctor reviews your plan', 'Confirmed plan lands in History'];

export function HomeScreen({ onStart }: { onStart: () => void }) {
  const { user } = useAuth();
  const clinic = useClinic();
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const latest = clinic.queue.find(c => c.mine);
  const callout = mobile ? type.callout : type.calloutT;
  return (
    <div className="vd-scroll vd-home" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: `20px 20px ${bottomBarInset}` }}>
      <style>{`
        ${media.tabletUp}{
          .vd-home{max-width:900px;margin:0 auto;width:100%;padding:20px 28px 32px!important}
          .vd-home-grid{display:grid!important;grid-template-columns:minmax(0,1fr) 300px;gap:24px;align-items:start;width:100%;flex:1}
          .vd-home-hero{min-height:calc(100dvh - 160px)}
          .vd-home-side{display:flex!important;position:sticky;top:28px}
        }
        ${media.desktopUp}{
          .vd-home{max-width:1200px;padding:24px 32px 32px!important}
          .vd-home-grid{grid-template-columns:minmax(0,640px) 340px;gap:32px;justify-content:center}
          .vd-home-side{top:32px}
        }
      `}</style>

      <AppHeader
        title={greeting(user?.name || 'Alex Kumar')}
        sticky={false}
        actions={<PatientNotify />}
      />

      <div className="vd-home-grid">
        <div className="vd-home-hero" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center', padding: '12px 0' }}>
          <MiraPresence size={mobile ? 152 : bp === 'tablet' ? 168 : 184} />
          <div>
            <div style={{ ...(mobile ? type.headline : type.headlineT), color: ink.primary }}>Dr. Mira is ready</div>
            <div style={{ ...(mobile ? type.body : type.bodyT), color: ink.soft, marginTop: 8, maxWidth: 270 }}>
              Start a consult and just talk — no forms.
            </div>
          </div>
          <Button icon="mic" onClick={onStart}>Start consultation</Button>
        </div>

        <aside className="vd-home-side" aria-label="How it works" style={{ display: 'none', flexDirection: 'column', gap: 12 }}>
          <Card>
            <div style={{ ...type.micro, color: ink.secondary }}>How a visit works</div>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, ...type.subhead, color: ink.body }}>
                <span style={{ flex: 'none', width: 22, height: 22, borderRadius: radius.pill, background: gradients.primary, color: 'var(--vd-ink-on-brand)', ...type.caption, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                {s}
              </div>
            ))}
          </Card>
          {bp === 'desktop' && (
            <Card>
              <div style={{ ...type.micro, color: ink.secondary }}>Latest plan</div>
              {latest ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <StatusPill status={latest.status} />
                    <div style={{ ...type.footnoteT, color: ink.secondary, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{latest.meta}</div>
                  </div>
                  <div style={{ ...type.subheadT, fontWeight: 700, color: ink.primary, marginTop: 6 }}>{latest.title}</div>
                </>
              ) : (
                <div style={{ ...type.calloutD, color: ink.secondary, marginTop: 8 }}>No plan yet — your first consult creates one.</div>
              )}
            </Card>
          )}
          <Card>
            <div style={{ ...callout, color: ink.body }}>
              Usual review wait is under an hour. If symptoms worsen, seek urgent care right away.
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
