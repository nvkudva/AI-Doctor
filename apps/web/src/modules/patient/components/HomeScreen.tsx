// Patient home dashboard: what needs attention today — the next dose, the next
// appointment, results flagged for review, and notes from the doctor. Starting
// a consult is the nav orb, so there is no hero here (DESIGN §11.5).
import { useNavigate } from 'react-router';
import { AppHeader, Card, Icon, StatusPill, ThemeToggle, bottomBarInset, greeting, type IconName } from '../../../lib/ui';
import { ink, lines, media, radius, space, type } from '../../../lib/theme';
import { relAge } from '../../../lib/core';
import { useAuth } from '../../../shell/auth';
import { useBreakpoint } from '../../../shell/viewport';
import { useClinic } from '../../../store';
import { seedAppointments, seedLabs } from '../../../store/seeds';
import { PatientNotify, usePatientNotices } from './PatientNotify';

const homeCss = `
.vd-home-grid{display:flex;flex-direction:column;gap:2px}
${media.tabletUp}{
  .vd-home{max-width:900px;margin:0 auto;width:100%;padding:20px 28px 32px!important}
  .vd-home-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;align-items:start}
}
${media.desktopUp}{
  .vd-home{max-width:1200px;padding:24px 32px 32px!important}
  .vd-home-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:0 28px}
}`;

export function HomeScreen({ onStart }: { onStart: () => void }) {
  const { user } = useAuth();
  const clinic = useClinic();
  const nav = useNavigate();
  const mobile = useBreakpoint() === 'mobile';

  const rx = clinic.prescriptions.filter(p => p.nextDose);
  const flagged = seedLabs.filter(l => !l.ok);
  const latest = clinic.queue.find(c => c.mine);
  const notices = usePatientNotices();
  const callout = mobile ? type.callout : type.calloutT;

  return (
    <div className="vd-scroll vd-home" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 20px ${bottomBarInset}` }}>
      <style>{homeCss}</style>

      <AppHeader
        title={greeting(user?.name || 'Alex Kumar')}
        subtitle={mobile ? undefined : 'Here’s what needs you today.'}
        sticky={false}
        actions={<><ThemeToggle /><PatientNotify /></>}
        style={{ marginBottom: space[3] }}
      />

      <div className="vd-home-grid">
        <Section title="Medication">
          {rx.length === 0
            ? <Empty body="No active prescriptions. An approved plan adds one here." />
            : rx.map((p, i) => (
              <Row
                key={i}
                icon="drop"
                title={p.name}
                detail={p.detail}
                meta={p.nextDose}
                onClick={() => nav('/patient/profile')}
              />
            ))}
        </Section>

        <Section title="Appointment">
          {seedAppointments.length === 0
            ? <Empty body="Nothing booked. Tests a doctor orders appear here." />
            : seedAppointments.map(a => (
              <Row key={a.id} icon="clock" title={a.title} detail={a.where} meta={a.when} />
            ))}
        </Section>

        <Section title="Results">
          {flagged.length === 0
            ? <Empty body="All results are within range." />
            : flagged.map((l, i) => (
              <Row
                key={i}
                icon="doc"
                title={l.name}
                detail={`${l.result} · ${l.date}`}
                meta="Needs review"
                tone="var(--vd-warn-fg)"
                onClick={() => nav('/patient/records?tab=labs')}
              />
            ))}
        </Section>

        <Section title="From your doctor">
          {notices.length === 0
            ? <Empty body="No messages. Review decisions land here." />
            : notices.map(({ n, i }) => (
              <Row
                key={i}
                icon="bell"
                title={n.t}
                detail={n.d}
                meta={n.at ? relAge(n.at) : undefined}
                onClick={n.caseId ? () => nav('/patient/recommendation') : undefined}
              />
            ))}
        </Section>

        {latest && (
          <Section title="Your latest plan">
            <Card level={1} pad="13px 15px">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusPill status={latest.status} />
                <div style={{ ...type.footnote, color: ink.secondary, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{latest.meta}</div>
              </div>
              <div style={{ ...callout, fontWeight: 700, color: ink.primary, marginTop: 6 }}>{latest.title}</div>
            </Card>
          </Section>
        )}

        <Section title="Feeling unwell?">
          <Card level={1} pad="13px 15px" onClick={onStart}>
            <div style={{ ...callout, fontWeight: 700, color: ink.primary }}>Start a consultation</div>
            <div style={{ ...type.footnote, color: ink.secondary, marginTop: 2 }}>
              Talk to Dr. Mira — no forms. A licensed doctor reviews every plan.
            </div>
          </Card>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ minWidth: 0, marginBottom: space[4] }}>
      <div style={{ ...type.subhead, fontWeight: 700, color: ink.primary, margin: `${space[3]}px 4px ${space[3]}px` }}>{title}</div>
      {children}
    </section>
  );
}

function Row({ icon, title, detail, meta, tone, onClick }: {
  icon: IconName; title: string; detail?: string; meta?: string; tone?: string; onClick?: () => void;
}) {
  return (
    <Card level={1} pad="12px 14px" onClick={onClick} style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{
          flex: 'none', width: 34, height: 34, borderRadius: radius.pill, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--vd-surface-chip)', color: tone || ink.secondary,
        }}>
          <Icon name={icon} size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>{title}</div>
          {detail && <div style={{ ...type.footnote, color: ink.secondary, marginTop: 1 }}>{detail}</div>}
          {meta && (
            <div style={{ ...type.caption, fontWeight: 700, color: tone || ink.soft, marginTop: 4 }}>{meta}</div>
          )}
        </div>
        {onClick && <span style={{ flex: 'none', display: 'flex', color: ink.muted, transform: 'rotate(-90deg)' }}><Icon name="chevD" size={16} /></span>}
      </div>
    </Card>
  );
}

function Empty({ body }: { body: string }) {
  return (
    <div style={{ ...type.footnote, color: ink.secondary, padding: `${space[4]}px ${space[4]}px`, border: `1px dashed ${lines.hairline}`, borderRadius: radius.lg }}>
      {body}
    </div>
  );
}
