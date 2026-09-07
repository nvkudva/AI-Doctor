// Booking a test the plan ordered. There is no availability table yet, so the
// slots are generated from the lab's opening hours and a fixed grid; what the
// patient picks is written straight in as a booked appointment. The lab list
// and the real availability lookup are in patient-todo.md.
import { useMemo, useState } from 'react';
import { Button, Card, Icon, MicroLabel } from '../../../lib/ui';
import type { AppointmentSlot } from '../../../store/types';
import s from './BookTestScreen.module.css';

const LABS = [
  { name: 'Apollo Diagnostics · Koramangala', note: '2.4 km · open until 8 pm' },
  { name: 'CityCare · Imaging, Ground floor', note: 'At the hospital · open until 6 pm' },
];

const HOURS = [8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 16];
const DAYS = 4;

export function BookTestScreen({ title, note, booked, onConfirm, onBack }: {
  title: string;
  /** Why and by when, straight off the plan item. */
  note: string;
  /** An existing booking for this test, if the patient already made one. */
  booked?: AppointmentSlot;
  onConfirm: (startsAt: number, location: string) => void;
  onBack: () => void;
}) {
  const [dayOffset, setDay] = useState(1);
  const [labIdx, setLab] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => startOfDay(Date.now()) + (i + 1) * 86400000), []);
  const day = days[dayOffset - 1];
  // Two of the grid's nine slots are already gone — a booking screen that never
  // shows a taken slot teaches the patient nothing about how full the lab is.
  const gone = useMemo(() => new Set([0, 7].map(i => HOURS[i])), []);
  const slots = useMemo(() => HOURS.map(h => ({
    at: day + Math.round(h * 3600000),
    taken: gone.has(h),
  })), [day, gone]);

  return (
    <div className={s.screen}>
      <div className={s.top}>
        <Button variant="secondary" icon="chevL" onClick={onBack} className={s.back}>Plan</Button>
        <div className={s.pageTitle}>Book your test</div>
      </div>

      <Card level={1} className={s.what}>
        <span className={s.whatIcon}><Icon name="drop" size={19} /></span>
        <div className={s.whatBody}>
          <div className={s.whatName}>{title}</div>
          <div className={s.whatNote}>{note}</div>
        </div>
      </Card>

      {booked ? (
        <Card className={s.confirmed}>
          <div className={s.confirmedHead}>
            <span className={s.tick}><Icon name="check" size={16} /></span>
            <div className={s.confirmedWhen}>{whenLine(booked.startsAt)}</div>
          </div>
          <div className={s.confirmedWhere}>{booked.location}. Bring a photo ID.</div>
        </Card>
      ) : (
        <>
          <MicroLabel>Where</MicroLabel>
          <Card
            level={1}
            className={s.lab}
            onClick={() => setLab(i => (i + 1) % LABS.length)}
          >
            <div className={s.labBody}>
              <div className={s.labName}>{LABS[labIdx].name}</div>
              <div className={s.labNote}>{LABS[labIdx].note}</div>
            </div>
            <Icon name="chevD" size={18} />
          </Card>

          <MicroLabel>When</MicroLabel>
          <div className={s.days}>
            {days.map((d, i) => {
              const on = i + 1 === dayOffset;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { setDay(i + 1); setPicked(null); }}
                  className={`${s.day}${on ? ' ' + s.dayOn : ''}`}
                >
                  <span className={s.dayName}>{new Date(d).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</span>
                  <span className={s.dayNum}>{new Date(d).getDate()}</span>
                </button>
              );
            })}
          </div>

          <div className={s.dayLabel}>
            {new Date(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div className={s.slots}>
            {slots.map(sl => {
              const on = picked === sl.at;
              return (
                <button
                  key={sl.at}
                  type="button"
                  disabled={sl.taken}
                  aria-pressed={on}
                  onClick={() => setPicked(sl.at)}
                  className={`${s.slot}${sl.taken ? ' ' + s.slotGone : ''}${on ? ' ' + s.slotOn : ''}`}
                >
                  {timeLabel(sl.at)}
                </button>
              );
            })}
          </div>

          {picked !== null && (
            <Card tone="panel" bordered={false} className={s.summary}>
              <div className={s.summaryWhen}>{whenLine(picked)}</div>
              <div className={s.summaryWhere}>{LABS[labIdx].name}. Bring a photo ID.</div>
            </Card>
          )}

          <Button
            fullWidth
            disabled={picked === null}
            onClick={() => picked !== null && onConfirm(picked, LABS[labIdx].name)}
          >
            {picked === null ? 'Pick a time' : 'Confirm this slot'}
          </Button>
        </>
      )}
    </div>
  );
}

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function whenLine(at: number): string {
  const d = new Date(at);
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${timeLabel(at)}`;
}
