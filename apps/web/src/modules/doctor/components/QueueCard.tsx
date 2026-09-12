// One review-queue row on a phone. It carries the same decision fields as the
// desk row: who, the plan, urgency, how many safety flags, and how long they
// have waited. The phone used to drop the flag count and the wait, and add a
// PENDING REVIEW pill identical on every row — the queue is pending by
// definition, so that pill carried no information at all (DESIGN-REVIEW D9).
import { slaCountdown, waitAge, waitTone, type CaseItem } from '../../../lib/core';
import { Card, Icon, StatusPill } from '../../../lib/ui';
import s from './QueueCard.module.css';

const DOT: Record<string, string> = {
  high: 'var(--vd-ok-fg)', medium: 'var(--vd-warn-fg)', low: 'var(--vd-bad-fg)',
};

export function QueueCard({ c, selected, onSelect }: { c: CaseItem; selected?: boolean; onSelect: () => void }) {
  const urgent = c.rec.urgency === 'urgent';
  const sla = c.submittedAt ? slaCountdown(c.submittedAt) : null;
  const concerns = c.flags.filter(f => f.severity !== 'info').length;
  return (
    <Card
      className={[s.card, urgent && (selected ? s.urgentSelected : s.urgent)].filter(Boolean).join(' ')}
      level={selected ? 3 : 2}
      selected={selected}
      onClick={onSelect}
      pad={16}
    >
      <div className={s.head}>
        <div className={s.name}>{c.patient}</div>
        {c.submittedAt && (
          <div className={s.wait} style={{ color: waitTone(c.submittedAt) }}>
            waiting {waitAge(c.submittedAt)}
          </div>
        )}
      </div>
      <div className={s.title}>{c.title}</div>
      {(c.inferred?.[0] || c.summary) && (
        <div className={s.summary}>{c.inferred?.[0] || c.summary}</div>
      )}
      <div className={s.tags}>
        <span
          title={`AI confidence: ${c.confidence}`}
          className={s.confidence}
          style={{ background: DOT[c.confidence] ?? DOT.low }}
        />
        <StatusPill status={c.rec.urgency} />
        {concerns > 0 && (
          <span className={s.concerns}>
            <Icon name="alert" size={11} />
            {concerns} safety flag{concerns === 1 ? '' : 's'}
          </span>
        )}
        {sla?.breached && <span className={s.breach} style={{ color: sla.tone }}>{sla.label}</span>}
      </div>
    </Card>
  );
}
