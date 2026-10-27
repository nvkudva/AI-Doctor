// The dose schedule. Times are read out of each prescription's own timing text
// (store/doses.ts); the ticks are this device's, because nothing in the schema
// records a swallowed dose. Where that record lives is stated in Profile ->
// About rather than in this screen's header (DESIGN-REVIEW D14).
import { useState } from 'react';
import { startOfDay, timeLabel } from '../../../lib/core';
import { AppHeader, Card, EmptyState, Icon, MenuRow, MicroLabel, Popover, ThemeToggle } from '../../../lib/ui';
import { PatientNotify } from './PatientNotify';
import { doseForm, doseState, type DoseState } from '../../../store/doses';
import type { Dose } from '../../../store/types';
import s from './MedicinesScreen.module.css';

const TONE: Record<DoseState, { bg: string; fg: string; icon: 'check' | 'x' | 'drop' }> = {
  taken: { bg: 'var(--vd-ok-bg)', fg: 'var(--vd-ok-fg)', icon: 'check' },
  skipped: { bg: 'var(--vd-surface-chip)', fg: 'var(--vd-ink-3)', icon: 'x' },
  missed: { bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)', icon: 'x' },
  due: { bg: 'var(--vd-rx-bg)', fg: 'var(--vd-rx-fg)', icon: 'drop' },
  later: { bg: 'var(--vd-surface-chip)', fg: 'var(--vd-ink-4)', icon: 'drop' },
};

export function MedicinesScreen({ doses, onTaken, onSkipped }: {
  doses: Dose[];
  onTaken: (id: string, taken: boolean) => void;
  onSkipped: (id: string, skipped: boolean) => void;
}) {
  const header = (
    <AppHeader title="Your medicines" actions={<><ThemeToggle /><PatientNotify /></>} />
  );
  if (doses.length === 0) {
    return (
      <div className={s.screen}>
        {header}
        <EmptyState
          icon="drop"
          title="No medicines to take"
          body="An approved prescription puts its doses on this schedule."
        />
      </div>
    );
  }
  const past = doses.filter(d => doseState(d) !== 'later');
  const done = past.filter(d => d.taken).length;
  const missed = past.length - done;
  const today = startOfDay(Date.now());
  const groups = [
    { label: 'Today', rows: doses.filter(d => startOfDay(d.at) === today) },
    { label: 'Tomorrow', rows: doses.filter(d => startOfDay(d.at) === today + 86400000) },
  ].filter(g => g.rows.length > 0);

  return (
    <div className={s.screen}>
      {header}
      <Card className={s.adherence}>
        {/* Green is for confirmed-good only: no doses taken is not that, so the
            count stays neutral until there is one, and the label counts the
            same thing the meter fills (DESIGN-REVIEW D12). */}
        <div className={s.tallyRow}>
          <div className={`${s.tally}${done > 0 ? ' ' + s.tallyDone : ''}`}>{done}</div>
          <div className={s.tallyLabel}>
            of {past.length} dose{past.length === 1 ? '' : 's'} taken so far
            {missed > 0 && <span className={s.tallyMissed}> · {missed} missed</span>}
          </div>
        </div>
        <div className={s.bars}>
          {past.map(d => (
            <span
              key={d.id}
              className={`${s.bar}${d.taken ? ' ' + s.barTaken : ' ' + s.barMissed}`}
              title={`${d.rx} · ${timeLabel(d.at)} · ${d.taken ? 'taken' : 'missed'}`}
            />
          ))}
          {doses.filter(d => doseState(d) === 'later').map(d => (
            <span key={d.id} className={s.bar} />
          ))}
        </div>
        <div className={s.adherenceNote}>
          Tell Dr. Mira if you have missed doses.
        </div>
      </Card>

      {groups.map(g => (
        <div key={g.label}>
          <MicroLabel>{g.label}</MicroLabel>
          <div className={s.list}>
            {g.rows.map(d => <DoseRow key={d.id} d={d} onTaken={onTaken} onSkipped={onSkipped} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function DoseRow({ d, onTaken, onSkipped }: {
  d: Dose;
  onTaken: (id: string, taken: boolean) => void;
  onSkipped: (id: string, skipped: boolean) => void;
}) {
  const state = doseState(d);
  const tone = TONE[state];
  const [menu, setMenu] = useState(false);
  // Recording a dose is the daily job of this screen; it used to offer only the
  // retrospective "Took it late", so every dose still to come had no action at
  // all (D14). Every dose that is not already recorded gets the tick.
  const recordable = state === 'due' || state === 'missed' || state === 'later';
  return (
    <div className={`${s.row}${state === 'later' ? ' ' + s.rowLater : ''}${d.taken ? ' ' + s.rowTaken : ''}`}>
      <div className={s.time}>{timeLabel(d.at)}</div>
      <Card level={1} pad="14px 16px" className={`${s.card}${state === 'due' ? ' ' + s.cardDue : ''}`}>
        {/* The dose's own form, not one droplet repeated down the page. A
            recorded dose keeps the state glyph, because that is what the row
            is now about (D26). */}
        <span className={s.icon} style={{ background: tone.bg, color: tone.fg }}>
          <Icon name={state === 'taken' || state === 'skipped' ? tone.icon : doseForm(d.rx, d.detail)} size={17} />
        </span>
        <div className={s.body}>
          <div className={s.name}>{d.rx}</div>
          <div className={s.detail}>{d.detail}</div>
          {state === 'taken' && (
            <div className={s.stamp}>Taken{d.takenAt ? ` at ${timeLabel(d.takenAt)}` : ''}</div>
          )}
          {state === 'skipped' && <div className={s.stamp}>Skipped</div>}
        </div>
        {recordable && (
          <button
            type="button"
            className={`${s.take}${state === 'due' ? ' ' + s.takeDue : ''}`}
            aria-label={`Record ${d.rx} at ${timeLabel(d.at)} as taken`}
            onClick={() => onTaken(d.id, true)}
          >
            <Icon name="check" size={24} />
          </button>
        )}
        <div className={s.moreWrap}>
          <button
            type="button"
            className={s.more}
            aria-label={`More for ${d.rx} at ${timeLabel(d.at)}`}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu(o => !o)}
          >
            <Icon name="chevD" size={16} />
          </button>
          <Popover open={menu} onClose={() => setMenu(false)} label="Dose actions" align="right" width={200}>
            {!d.taken && (
              <MenuRow icon="check" onClick={() => { setMenu(false); onTaken(d.id, true); }}>Mark taken</MenuRow>
            )}
            {d.taken && (
              <MenuRow icon="x" onClick={() => { setMenu(false); onTaken(d.id, false); }}>Undo</MenuRow>
            )}
            {!d.skipped && (
              <MenuRow icon="x" onClick={() => { setMenu(false); onSkipped(d.id, true); }}>Skip this dose</MenuRow>
            )}
            {d.skipped && (
              <MenuRow icon="x" onClick={() => { setMenu(false); onSkipped(d.id, false); }}>Un-skip</MenuRow>
            )}
          </Popover>
        </div>
      </Card>
    </div>
  );
}

