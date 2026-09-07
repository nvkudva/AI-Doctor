// The doctor's book: a day on a real time axis, grouped by clinic session, with
// free time visible between the bookings. This is the screen that used to be a
// second copy of the review queue.
import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, Icon, MicroLabel, StatusPill, pressProps } from '../../../lib/ui';
import type { AppointmentSlot, SlotStatus } from '../../../store/types';
import s from './AppointmentsScreen.module.css';

const KIND_ICON: Record<AppointmentSlot['kind'], 'person' | 'video' | 'cal'> = {
  in_person: 'person', video: 'video', imaging: 'cal', lab: 'cal',
};

// Clinic hours come from the hospital's own SLA config (§2.1). Until that is
// wired through the store, the desk shows the two sessions the seed describes.
const SESSIONS = [
  { name: 'Morning', from: 9, to: 13 },
  { name: 'Evening', from: 16, to: 20 },
];

export function AppointmentsScreen({ appointments, onSlotStatus }: {
  appointments: AppointmentSlot[];
  onSlotStatus: (id: string, status: SlotStatus) => void;
}) {
  const [dayOffset, setDay] = useState(0);
  const day = useMemo(() => startOfDay(Date.now() + dayOffset * 86400000), [dayOffset]);
  const ofDay = useMemo(
    () => appointments.filter(a => startOfDay(a.startsAt) === day).sort((a, b) => a.startsAt - b.startsAt),
    [appointments, day],
  );
  const booked = ofDay.filter(a => a.status === 'booked').length;
  const noShows = ofDay.filter(a => a.status === 'no_show').length;
  const cancelled = ofDay.filter(a => a.status === 'cancelled').length;

  return (
    <>
      <div className={s.dayBar}>
        <div className={s.stepper}>
          <button type="button" className={s.step} onClick={() => setDay(d => d - 1)} aria-label="Previous day">
            <Icon name="chevL" size={16} />
          </button>
          <div className={s.dayName}>{dayLabel(day)}</div>
          <button type="button" className={s.step} onClick={() => setDay(d => d + 1)} aria-label="Next day">
            <Icon name="chevR" size={16} />
          </button>
        </div>
        <div className={s.daySummary}>
          {ofDay.length === 0 ? 'Nothing booked' : [
            `${booked} booked`,
            noShows ? `${noShows} no-show` : '',
            cancelled ? `${cancelled} cancelled` : '',
          ].filter(Boolean).join(' · ')}
        </div>
        {dayOffset !== 0 && <Button variant="tertiary" onClick={() => setDay(0)}>Today</Button>}
      </div>

      {ofDay.length === 0 ? (
        <EmptyState
          icon="clock"
          title="No appointments this day"
          body="Escalating a case from the review queue books a slot here."
        />
      ) : SESSIONS.map((session) => {
        const rows = ofDay.filter(a => hourOf(a.startsAt) >= session.from && hourOf(a.startsAt) < session.to);
        if (!rows.length) return null;
        return (
          <div key={session.name}>
            <div className={s.band}>
              <MicroLabel>{session.name}</MicroLabel>
              <span className={s.bandHours}>
                {pad(session.from)}:00 – {pad(session.to)}:00 · {sessionNote(rows)}
              </span>
              <span className={s.bandRule} />
            </div>
            <div className={s.slots}>
              {rows.map(a => (
                <Slot key={a.id} a={a} onSlotStatus={onSlotStatus} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function Slot({ a, onSlotStatus }: { a: AppointmentSlot; onSlotStatus: (id: string, status: SlotStatus) => void }) {
  // Attendance is only knowable once the slot has started; before that the
  // controls would be asking the doctor to predict the future.
  const started = a.startsAt <= Date.now();
  const canMark = a.status === 'booked' && started;
  return (
    <div className={s.slot}>
      <div className={s.time}>{timeLabel(a.startsAt)}</div>
      <Card
        pad="12px 16px"
        level={1}
        className={`${s.card}${a.status === 'cancelled' ? ' ' + s.dim : ''}`}
      >
        <span className={s.kind}><Icon name={KIND_ICON[a.kind]} size={18} /></span>
        <div className={s.body}>
          <div className={`${s.patient}${a.status === 'cancelled' ? ' ' + s.struck : ''}`}>{a.patient}</div>
          <div className={s.where}>{[a.location, `${a.minutes} min`].filter(Boolean).join(' · ')}</div>
        </div>
        {canMark && (
          <div className={s.actions}>
            <span {...pressProps(() => onSlotStatus(a.id, 'completed'), 'Mark attended')} className={s.markOk}>
              Attended
            </span>
            <span {...pressProps(() => onSlotStatus(a.id, 'no_show'), 'Mark no-show')} className={s.markBad}>
              No-show
            </span>
          </div>
        )}
        {a.status === 'no_show' && (
          <span {...pressProps(() => onSlotStatus(a.id, 'booked'), 'Undo no-show')} className={s.undo}>Undo</span>
        )}
        <StatusPill status={a.status} />
      </Card>
    </div>
  );
}

// What the session actually holds, not just what is still to come: a morning of
// finished appointments reading "0 booked" is worse than saying nothing.
function sessionNote(rows: AppointmentSlot[]): string {
  const parts = [
    count(rows, 'booked', 'to be seen'),
    count(rows, 'completed', 'seen'),
    count(rows, 'no_show', 'no-show'),
    count(rows, 'cancelled', 'cancelled'),
  ].filter(Boolean);
  return parts.join(' · ');
}

function count(rows: AppointmentSlot[], status: SlotStatus, label: string): string {
  const n = rows.filter(r => r.status === status).length;
  return n ? `${n} ${label}` : '';
}

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function hourOf(at: number): number { return new Date(at).getHours(); }
function pad(n: number): string { return String(n).padStart(2, '0'); }
function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function dayLabel(at: number): string {
  const days = Math.round((at - startOfDay(Date.now())) / 86400000);
  const d = new Date(at);
  const full = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  if (days === 0) return `Today · ${full}`;
  if (days === 1) return `Tomorrow · ${full}`;
  return full;
}
