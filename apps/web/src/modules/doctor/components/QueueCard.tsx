// One review-queue row: patient, complaint, wait time, status.
import { waitAge, waitTone, type CaseItem } from '../../../lib/core';
import { Card, StatusPill } from '../../../lib/ui';
import s from './QueueCard.module.css';

const DOT: Record<string, string> = {
  high: 'var(--vd-ok-fg)', medium: 'var(--vd-warn-fg)', low: 'var(--vd-bad-fg)',
};

export function QueueCard({ c, selected, onSelect }: { c: CaseItem; selected?: boolean; onSelect: () => void }) {
  const urgent = c.rec.urgency === 'urgent';
  return (
    <Card
      className={[s.card, urgent && (selected ? s.urgentSelected : s.urgent)].filter(Boolean).join(' ')}
      level={selected ? 3 : 2}
      selected={selected}
      onClick={onSelect}
      pad={16}
    >
      <div className={s.name}>{c.patient}</div>
      <div className={s.title}>{c.title}</div>
      {(c.inferred?.[0] || c.summary) && (
        <div className={s.summary}>{c.inferred?.[0] || c.summary}</div>
      )}
      <div className={s.meta}>
        {c.meta}{c.submittedAt ? (
          <> · waiting <b style={{ color: waitTone(c.submittedAt) }}>{waitAge(c.submittedAt)}</b></>
        ) : ''}
      </div>
      <div className={s.tags}>
        <span
          title={`AI confidence: ${c.confidence}`}
          className={s.confidence}
          style={{ background: DOT[c.confidence] ?? DOT.low }}
        />
        <StatusPill status={c.status} />
        {(urgent || c.rec.urgency === 'soon') && <StatusPill status={c.rec.urgency} />}
      </div>
    </Card>
  );
}
