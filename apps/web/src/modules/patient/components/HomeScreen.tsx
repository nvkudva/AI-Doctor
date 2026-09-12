// Patient home dashboard: what needs attention today — the next dose, the next
// appointment, results flagged for review, and notes from the doctor. Starting
// a consult is the nav orb, so there is no hero here (DESIGN §11.5).
import { useNavigate } from 'react-router';
import { myCase, planStatus } from '../../../lib/core';
import { AppHeader, Button, Card, Icon, Skeleton, StatusPill, ThemeToggle, greeting, type IconName } from '../../../lib/ui';
import { doseState } from '../../../store/doses';
import { toPanels } from '../../../store/labs';
import { useAuth } from '../../../shell/auth';
import { useBreakpoint } from '../../../shell/viewport';
import { useClinic } from '../../../store';

import { PatientNotify } from './PatientNotify';
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
  const panels = toPanels(clinic.labs);
  const flagged = panels.filter(p => p.worst !== 'normal');
  // Nothing on this screen may assert anything until the rows are in.
  const pending = clinic.load === 'loading';
  const failed = clinic.load === 'error';
  const upcoming = clinic.appointments
    .filter(a => a.status === 'booked' && a.startsAt >= Date.now())
    .sort((a, b) => a.startsAt - b.startsAt);
  const latest = myCase(clinic.queue);

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
          <Section>
            {/* The button is the affordance, so the card itself is not also a
                button — a control inside a clickable card is two hit targets
                for one action, and screen readers announce the nesting. */}
            <Card level={1} pad="13px 15px">
              <div className={s.ctaTitle}>How is it going?</div>
              <div className={s.ctaBody}>
                It has been a few days since your plan was approved. One tap tells your doctor how you are doing.
              </div>
              <Button variant="secondary" onClick={onCheckIn} className={s.ctaAction}>
                Answer
              </Button>
            </Card>
          </Section>
        )}

        <Section title="Medication">
          {pending
            ? <Skeleton />
            : failed
            ? <Failed what="your medicines" onRetry={clinic.retry} />
            : !nextDose
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

        <Section title="Appointment" side>
          {pending
            ? <Skeleton lines={2} />
            : failed
            ? <Failed what="your appointments" onRetry={clinic.retry} />
            : upcoming.length === 0
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
        <Section title="Results" side>
          {pending
            ? <Skeleton />
            : failed
            ? <Failed what="your results" onRetry={clinic.retry} />
            : panels.length === 0
            ? <Empty body="No results yet. Tests your doctor orders appear here once they are back." />
            : flagged.length === 0
            ? <Empty body="Every result so far is inside its reference range." />
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

        {latest && (
          <Section title="Your latest plan">
            <Card
              level={1}
              pad="13px 15px"
              onClick={() => nav(`/patient/plan/${encodeURIComponent(latest.id)}`)}
              aria-label={`Open your plan: ${latest.title}`}
            >
              <div className={s.planRow}>
                <StatusPill status={planStatus(latest.status)} />
                <div className={s.planMeta}>{latest.meta}</div>
              </div>
              <div className={s.planTitle}>{latest.title}</div>
            </Card>
          </Section>
        )}

        <Section side>
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

// A heading is only worth a line of chrome when it groups something the cards
// below it do not already say (D20).
function Section({ title, side, children }: { title?: string; side?: boolean; children: React.ReactNode }) {
  return (
    <section className={`${s.section} ${side ? s.colSide : s.colMain}`}>
      {title && <div className={s.sectionTitle}>{title}</div>}
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

// A failed fetch is never rendered as good news: the card says it could not
// load and offers the retry, rather than falling through to an empty state.
function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className={s.failed} role="status">
      <span>Couldn’t load {what}.</span>
      <Button variant="tertiary" onClick={onRetry}>Retry</Button>
    </div>
  );
}

function Empty({ body }: { body: string }) {
  return (
    <div className={s.empty}>{body}</div>
  );
}
