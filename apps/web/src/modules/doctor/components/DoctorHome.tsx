// Doctor landing: the shift, not the queue. Five numbers a doctor acts on, then
// the two lists that are genuinely urgent — cases past or near the review
// target, and what is booked next. Everything here links out; nothing is
// reviewed in place.
import {
  isReviewable, slaCountdown, waitAge, type CaseItem,
} from '../../../lib/core';
import { Button, Card, CardHeader, EmptyState, Icon, StatusPill } from '../../../lib/ui';
import type { AppointmentSlot } from '../../../store/types';
import s from './DoctorHome.module.css';

const KIND_ICON: Record<AppointmentSlot['kind'], 'person' | 'video' | 'cal'> = {
  in_person: 'person', video: 'video', imaging: 'cal', lab: 'cal',
};

export function DoctorHome({ queue, appointments, onSelect, onSeeAll, onSeeReviews }: {
  queue: CaseItem[];
  appointments: AppointmentSlot[];
  onSelect: (id: string) => void;
  onSeeAll: () => void;
  onSeeReviews: () => void;
}) {
  const waiting = queue.filter(c => isReviewable(c.status));
  const urgent = waiting.filter(c => c.rec.urgency === 'urgent');
  const decided = queue.filter(c => c.reviewedAt && isToday(c.reviewedAt));
  const oldest = waiting
    .filter(c => c.submittedAt)
    .sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0))[0];
  const breached = waiting.filter(c => c.submittedAt && slaCountdown(c.submittedAt).breached);
  // Urgency first, then whatever has already passed the target.
  const needsYou = [...urgent, ...breached.filter(c => c.rec.urgency !== 'urgent')].slice(0, 3);
  const upcoming = appointments
    .filter(a => a.status === 'booked' && a.startsAt >= Date.now())
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, 3);

  return (
    <>
      <div className={s.stats}>
        <Stat value={String(waiting.length)} label="Waiting" tone="var(--vd-warn-fg)" sub="in the review queue" />
        <Stat value={String(urgent.length)} label="Urgent" tone="var(--vd-bad-fg)" sub={urgent.length ? 'red flag raised' : 'none right now'} />
        <Stat
          value={oldest?.submittedAt ? waitAge(oldest.submittedAt) : '—'}
          label="Longest wait"
          tone={breached.length ? 'var(--vd-bad-fg)' : 'var(--vd-ink-2)'}
          sub="target is 2h"
        />
        <Stat value={String(decided.length)} label="Decided today" tone="var(--vd-ok-fg)" sub={decidedSplit(decided)} />
        <Stat value={String(appointments.filter(a => a.status === 'booked' && isToday(a.startsAt)).length)} label="Booked today" tone="var(--vd-ink-2)" sub="still to be seen" />
      </div>

      {breached.length > 0 && (
        <div className={s.banner} role="status">
          <Icon name="alert" size={18} />
          <span className={s.bannerText}>
            {breached.length === 1 ? '1 case has' : `${breached.length} cases have`} passed the 2-hour review target.
          </span>
          <Button variant="tertiary" onClick={onSeeReviews}>Open the queue</Button>
        </div>
      )}

      {/* Side by side from the desk breakpoint: two stacked lists pushed the
          appointments below the fold in a 900px window. */}
      <div className={s.sections}>
        <Card tone="panel" level={1} className={s.section}>
          <CardHeader
            icon="alert"
            title="Needs you now"
            meta={needsYou.length > 0
              ? <span className={s.count}>{needsYou.length}</span>
              : undefined}
          />
          {needsYou.length > 0 ? (
            <div className={s.rows}>
              {needsYou.map(c => (
                <AttnRow
                  key={c.id}
                  icon="alert"
                  tone={c.rec.urgency === 'urgent' ? 'bad' : 'warn'}
                  title={`${c.patient} · ${c.title}`}
                  line={c.flags.find(f => f.severity !== 'info')?.text || c.summary}
                  meta={c.submittedAt ? `waiting ${waitAge(c.submittedAt)}` : c.meta}
                  tag={<StatusPill status={c.rec.urgency} />}
                  onClick={() => onSelect(c.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="check"
              title="Nothing urgent"
              body="No case is flagged urgent or past its review target."
              action={<Button variant="tertiary" onClick={onSeeReviews}>Open the queue</Button>}
            />
          )}
        </Card>

        <Card tone="panel" level={1} className={s.section}>
          <CardHeader icon="cal" title="Next appointments" />
          {upcoming.length > 0 ? (
            <>
              <div className={s.rows}>
                {upcoming.map(a => (
                  <AttnRow
                    key={a.id}
                    icon={KIND_ICON[a.kind]}
                    tone="info"
                    title={a.patient}
                    line={a.location || 'No location on file'}
                    meta={whenLabel(a.startsAt)}
                    onClick={onSeeAll}
                  />
                ))}
              </div>
              <Button variant="tertiary" fullWidth onClick={onSeeAll} className={s.seeAll}>
                See the whole book
              </Button>
            </>
          ) : (
            <EmptyState
              icon="clock"
              title="Nothing booked"
              body="Escalating a case from the review queue books a slot here."
              action={<Button variant="tertiary" onClick={onSeeAll}>Open appointments</Button>}
            />
          )}
        </Card>
      </div>
    </>
  );
}

function decidedSplit(decided: CaseItem[]): string {
  if (!decided.length) return 'nothing signed yet';
  const ok = decided.filter(c => c.decision === 'approved').length;
  return `${ok} approved · ${decided.length - ok} other`;
}

function isToday(at: number): boolean {
  const d = new Date(at);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

export function whenLabel(at: number): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((startOfDay(at) - startOfDay(Date.now())) / 86400000);
  if (days === 0) return time;
  if (days === 1) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Stat({ value, label, tone, sub }: { value: string; label: string; tone: string; sub: string }) {
  return (
    <Card pad="14px 16px" level={1} className={s.stat}>
      <div className={s.statValue} style={{ color: tone }}>{value}</div>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statSub}>{sub}</div>
    </Card>
  );
}

function AttnRow({ icon, tone, title, line, meta, tag, onClick }: {
  icon: 'alert' | 'person' | 'video' | 'cal';
  tone: 'bad' | 'warn' | 'info';
  title: string; line: string; meta: string;
  tag?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={s.attn}
    >
      <span className={`${s.attnIcon} ${s[tone]}`}><Icon name={icon} size={16} /></span>
      <div className={s.attnBody}>
        <div className={s.attnTitle}>{title}</div>
        <div className={s.attnLine}>{line}</div>
      </div>
      <div className={s.attnMeta}>{meta}</div>
      {tag}
      <Icon name="chevR" size={15} />
    </div>
  );
}
