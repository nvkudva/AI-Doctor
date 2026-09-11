// Patient home dashboard: what needs attention today — the next dose, the next
// appointment, results flagged for review, and notes from the doctor. Starting
// a consult is the nav orb, so there is no hero here (DESIGN §11.5).
import { useNavigate } from 'react-router';
import { AppHeader, Card, Icon, StatusPill, ThemeToggle, greeting, type IconName } from '../../../lib/ui';
import { relAge } from '../../../lib/core';
import { doseState } from '../../../store/doses';
import { toPanels } from '../../../store/labs';
import { useAuth } from '../../../shell/auth';
import { useBreakpoint } from '../../../shell/viewport';
import { useClinic } from '../../../store';

import { PatientNotify, usePatientNotices } from './PatientNotify';
import s from './HomeScreen.module.css';

const KIND_LABEL: Record<'in_person' | 'video' | 'imaging' | 'lab', string> = {
  in_person: 'Appointment with your doctor',
  video: 'Video consultation',
  imaging: 'Imaging appointment',
  lab: 'Lab test',
};

export function HomeScreen({ onStart, onCheckIn }: { onStart: () => void; onCheckIn: () => void }) {
  const { user } = useAuth();
  const clinic = useClinic();
  const nav = useNavigate();
  const mobile = useBreakpoint() === 'mobile';

  // The next dose that is still actionable — a schedule of eight rows belongs
  // on Medicines, not on the dashboard.
  const nextDose = clinic.doses.find(d => !d.taken && doseState(d) !== 'missed');
  const missed = clinic.doses.filter(d => doseState(d) === 'missed').length;
  const flagged = toPanels(clinic.labs).filter(p => p.worst !== 'normal');
  const upcoming = clinic.appointments
    .filter(a => a.status === 'booked' && a.startsAt >= Date.now())
    .sort((a, b) => a.startsAt - b.startsAt);
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
        {clinic.checkIn && (
          <Section title="A quick check">
            <Card level={1} pad="13px 15px" onClick={onCheckIn} aria-label="Answer the check-in about your plan">
              <div className={s.ctaTitle}>How is it going?</div>
              <div className={s.ctaBody}>
                It has been a few days since your plan was approved. One tap tells your doctor how you are doing.
              </div>
            </Card>
          </Section>
        )}

        <Section title="Medication">
          {!nextDose
            ? <Empty body="No doses due. An approved prescription puts its schedule here." />
            : (
              <Row
                icon="drop"
                title={nextDose.rx}
                detail={nextDose.detail}
                meta={missed ? `Next at ${timeLabel(nextDose.at)} · ${missed} missed` : `Next at ${timeLabel(nextDose.at)}`}
                tone={missed ? 'var(--vd-bad-fg)' : undefined}
                label="Open your medicine schedule"
                onClick={() => nav('/patient/medicines')}
              />
            )}
        </Section>

        <Section title="Appointment">
          {upcoming.length === 0
            ? <Empty body="Nothing booked. Tests a doctor orders appear here." />
            : upcoming.map(a => (
              <Row
                key={a.id}
                icon="clock"
                title={a.reason || KIND_LABEL[a.kind]}
                detail={a.location}
                meta={whenLine(a.startsAt)}
              />
            ))}
        </Section>

        {/* A dashboard tells you there is something to look at; the looking
            happens on Labs. One panel per row turned Home into a second copy
            of that screen. */}
        <Section title="Results">
          {flagged.length === 0
            ? <Empty body="All results are within range." />
            : (
              <Card
                level={1}
                pad="14px 16px"
                onClick={() => nav('/patient/records?tab=labs')}
                aria-label={`Review ${flagged.length} lab result${flagged.length === 1 ? '' : 's'}`}
                className={s.summary}
              >
                <span className={s.summaryCount}>{flagged.length}</span>
                <div className={s.summaryBody}>
                  <div className={s.summaryTitle}>
                    {flagged.length === 1 ? '1 result needs a look' : `${flagged.length} results need a look`}
                  </div>
                  <div className={s.summaryDetail}>{flagged.map(p => p.panel).join(' · ')}</div>
                </div>
                <Icon name="chevR" size={16} />
              </Card>
            )}
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
                label={n.caseId ? `Open your plan — ${n.t}` : undefined}
                onClick={n.caseId ? () => nav('/patient/recommendation') : undefined}
              />
            ))}
        </Section>

        {latest && (
          <Section title="Your latest plan">
            <Card
              level={1}
              pad="13px 15px"
              onClick={() => nav('/patient/recommendation')}
              aria-label={`Open your plan: ${latest.title}`}
            >
              <div className={s.planRow}>
                <StatusPill status={latest.status} />
                <div className={s.planMeta}>{latest.meta}</div>
              </div>
              <div className={s.planTitle}>{latest.title}</div>
            </Card>
          </Section>
        )}

        <Section title="Feeling unwell?">
          <Card level={1} pad="13px 15px" onClick={onStart} aria-label="Start a consultation with Dr. Mira">
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

function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function whenLine(at: number): string {
  const d = new Date(at);
  const days = Math.round((startOfDay(at) - startOfDay(Date.now())) / 86400000);
  const time = timeLabel(at);
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${time}`;
}

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={s.section}>
      <div className={s.sectionTitle}>{title}</div>
      {children}
    </section>
  );
}

function Row({ icon, title, detail, meta, tone, onClick, label }: {
  icon: IconName; title: string; detail?: string; meta?: string; tone?: string;
  onClick?: () => void;
  /** What activating the row does — a card that is a button needs one (QA-12). */
  label?: string;
}) {
  return (
    <Card level={1} pad="12px 14px" onClick={onClick} aria-label={label} className={s.row}>
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
