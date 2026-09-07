// One row of the review worklist. Wider and flatter than the QueueCard the
// mobile list uses: at a desk the doctor is scanning a column of decisions, so
// what matters is who, what, and how long is left before the 2h target.
import { slaCountdown, waitAge, type CaseItem } from '../../../lib/core';
import { Card, Icon, StatusPill } from '../../../lib/ui';
import s from './ReviewRow.module.css';

const DOT: Record<string, string> = {
  high: 'var(--vd-ok-fg)', medium: 'var(--vd-warn-fg)', low: 'var(--vd-bad-fg)',
};

export function ReviewRow({ c, selected, onSelect }: {
  c: CaseItem; selected?: boolean; onSelect: () => void;
}) {
  const urgent = c.rec.urgency === 'urgent';
  const sla = c.submittedAt ? slaCountdown(c.submittedAt) : null;
  const concerns = c.flags.filter(f => f.severity !== 'info').length;
  return (
    <Card
      className={[s.row, urgent && s.urgent, sla?.breached && s.breached].filter(Boolean).join(' ')}
      level={selected ? 3 : 2}
      selected={selected}
      onClick={onSelect}
      pad="15px 18px"
    >
      <span
        className={s.confidence}
        title={`AI confidence: ${c.confidence}`}
        style={{ background: DOT[c.confidence] ?? DOT.low }}
      />
      <div className={s.who}>
        <div className={s.patient}>{c.patient}</div>
        <div className={s.dx}>{c.inferred?.[0] || c.demo}</div>
      </div>
      <div className={s.plan}>
        <div className={s.title}>{c.title}</div>
        <div className={s.tags}>
          <StatusPill status={c.rec.urgency} />
          <StatusPill status={c.rec.type} />
          {concerns > 0 && (
            <span className={s.concerns}>
              <Icon name="alert" size={11} />
              {concerns} safety flag{concerns === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
      <div className={s.wait}>
        <div className={s.waited}>{c.submittedAt ? `waiting ${waitAge(c.submittedAt)}` : c.meta}</div>
        {sla && <div className={s.sla} style={{ color: sla.tone }}>{sla.label}</div>}
      </div>
      <Icon name="chevR" size={18} />
    </Card>
  );
}
