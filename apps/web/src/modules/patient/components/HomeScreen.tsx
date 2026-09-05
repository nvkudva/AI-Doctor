// Patient home dashboard: what needs attention today — the next dose, the next
// appointment, results flagged for review, and notes from the doctor. Starting
// a consult is the nav orb, so there is no hero here (DESIGN §11.5).
import { useNavigate } from 'react-router';
import { AppHeader, Card, Icon, StatusPill, ThemeToggle, greeting, type IconName } from '../../../lib/ui';
import { relAge } from '../../../lib/core';
import { useAuth } from '../../../shell/auth';
import { useBreakpoint } from '../../../shell/viewport';
import { useClinic } from '../../../store';
import { seedAppointments, seedLabs } from '../../../store/seeds';
import { PatientNotify, usePatientNotices } from './PatientNotify';
import s from './HomeScreen.module.css';

export function HomeScreen({ onStart }: { onStart: () => void }) {
  const { user } = useAuth();
  const clinic = useClinic();
  const nav = useNavigate();
  const mobile = useBreakpoint() === 'mobile';

  const rx = clinic.prescriptions.filter(p => p.nextDose);
  const flagged = seedLabs.filter(l => !l.ok);
  const latest = clinic.queue.find(c => c.mine);
  const notices = usePatientNotices();

  return (
    <div className={s.screen}>
      <AppHeader
        title={greeting(user?.name || 'Alex Kumar')}
        subtitle={mobile ? undefined : 'Here’s what needs you today.'}

        actions={<><ThemeToggle /><PatientNotify /></>}
        className={s.header}
      />

      <div className={s.grid}>
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
              <div className={s.planRow}>
                <StatusPill status={latest.status} />
                <div className={s.planMeta}>{latest.meta}</div>
              </div>
              <div className={s.planTitle}>{latest.title}</div>
            </Card>
          </Section>
        )}

        <Section title="Feeling unwell?">
          <Card level={1} pad="13px 15px" onClick={onStart}>
            <div className={s.ctaTitle}>Start a consultation</div>
            <div className={s.ctaBody}>
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
    <section className={s.section}>
      <div className={s.sectionTitle}>{title}</div>
      {children}
    </section>
  );
}

function Row({ icon, title, detail, meta, tone, onClick }: {
  icon: IconName; title: string; detail?: string; meta?: string; tone?: string; onClick?: () => void;
}) {
  return (
    <Card level={1} pad="12px 14px" onClick={onClick} className={s.row}>
      <div className={s.rowInner}>
        <span className={s.rowIcon} style={tone ? { color: tone } : undefined}>
          <Icon name={icon} size={18} />
        </span>
        <div className={s.rowBody}>
          <div className={s.rowTitle}>{title}</div>
          {detail && <div className={s.rowDetail}>{detail}</div>}
          {meta && <div className={s.rowMeta} style={tone ? { color: tone } : undefined}>{meta}</div>}
        </div>
        {onClick && <span className={s.rowChev}><Icon name="chevD" size={16} /></span>}
      </div>
    </Card>
  );
}

function Empty({ body }: { body: string }) {
  return (
    <div className={s.empty}>{body}</div>
  );
}
