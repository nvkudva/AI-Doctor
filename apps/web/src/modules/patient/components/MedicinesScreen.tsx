// The dose schedule. Times are read out of each prescription's own timing text
// (store/doses.ts); the ticks are this device's, because nothing in the schema
// records a swallowed dose. The adherence bar says so rather than implying the
// clinic is watching something it cannot see.
import { AppHeader, Card, EmptyState, Icon, MicroLabel, ThemeToggle } from '../../../lib/ui';
import { PatientNotify } from './PatientNotify';
import { doseState, type DoseState } from '../../../store/doses';
import type { Dose } from '../../../store/types';
import s from './MedicinesScreen.module.css';

const TONE: Record<DoseState, { bg: string; fg: string; icon: 'check' | 'x' | 'drop' }> = {
  taken: { bg: 'var(--vd-ok-bg)', fg: 'var(--vd-ok-fg)', icon: 'check' },
  missed: { bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)', icon: 'x' },
  due: { bg: 'var(--vd-rx-bg)', fg: 'var(--vd-rx-fg)', icon: 'drop' },
  later: { bg: 'var(--vd-surface-chip)', fg: 'var(--vd-ink-4)', icon: 'drop' },
};

export function MedicinesScreen({ doses, onTaken }: {
  doses: Dose[];
  onTaken: (id: string, taken: boolean) => void;
}) {
  const header = (
    <AppHeader title="Your medicines" actions={<><ThemeToggle /><PatientNotify /></>} />
  );
  if (doses.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon="drop"
          title="No medicines to take"
          body="An approved prescription puts its doses on this schedule."
        />
      </>
    );
  }
  const past = doses.filter(d => doseState(d) !== 'later');
  const done = past.filter(d => d.taken).length;
  const today = startOfDay(Date.now());
  const groups = [
    { label: 'Today', rows: doses.filter(d => startOfDay(d.at) === today) },
    { label: 'Tomorrow', rows: doses.filter(d => startOfDay(d.at) === today + 86400000) },
  ].filter(g => g.rows.length > 0);

  return (
    <>
      {header}
      <Card className={s.adherence}>
        <div className={s.tallyRow}>
          <div className={s.tally}>{done}</div>
          <div className={s.tallyLabel}>of {past.length} doses so far</div>
        </div>
        <div className={s.bars}>
          {past.map(d => (
            <span
              key={d.id}
              className={s.bar}
              style={{ background: d.taken ? 'var(--vd-ok-fg)' : 'var(--vd-bad-fg)' }}
              title={`${d.rx} · ${timeLabel(d.at)}`}
            />
          ))}
          {doses.filter(d => doseState(d) === 'later').map(d => (
            <span key={d.id} className={s.bar} style={{ background: 'var(--vd-surface-chip)' }} />
          ))}
        </div>
        <div className={s.adherenceNote}>
          Kept on this device. Tell Dr. Mira if you have missed doses — she passes it on with your next plan.
        </div>
      </Card>

      {groups.map(g => (
        <div key={g.label}>
          <MicroLabel>{g.label}</MicroLabel>
          <div className={s.list}>
            {g.rows.map(d => <DoseRow key={d.id} d={d} onTaken={onTaken} />)}
          </div>
        </div>
      ))}
    </>
  );
}

function DoseRow({ d, onTaken }: { d: Dose; onTaken: (id: string, taken: boolean) => void }) {
  const state = doseState(d);
  const tone = TONE[state];
  return (
    <div className={`${s.row}${state === 'later' ? ' ' + s.rowLater : ''}${d.taken ? ' ' + s.rowTaken : ''}`}>
      <div className={s.time}>{timeLabel(d.at)}</div>
      <Card level={1} pad="14px 16px" className={`${s.card}${state === 'due' ? ' ' + s.cardDue : ''}`}>
        <span className={s.icon} style={{ background: tone.bg, color: tone.fg }}>
          <Icon name={tone.icon} size={17} />
        </span>
        <div className={s.body}>
          <div className={s.name}>{d.rx}</div>
          <div className={s.detail}>{d.detail}</div>
        </div>
        {state === 'due' && (
          <button type="button" className={s.take} onClick={() => onTaken(d.id, true)}>Take</button>
        )}
        {state === 'missed' && (
          <button type="button" className={s.late} onClick={() => onTaken(d.id, true)}>Took it late</button>
        )}
        {d.taken && (
          <button type="button" className={s.undo} onClick={() => onTaken(d.id, false)}>Undo</button>
        )}
      </Card>
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
