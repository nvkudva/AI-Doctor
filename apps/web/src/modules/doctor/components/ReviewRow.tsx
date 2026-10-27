// One row of the review worklist, drawn as a line in an inset-grouped list: no
// card of its own, so the list is one surface with hairlines between decisions.
// At a desk the doctor is scanning a column of them, so what matters is who,
// what, and how long is left before the 2h target.
import { caseRowLabel, slaCountdown, waitAge, type CaseItem } from '../../../lib/core';
import { Icon, StatusPill, pressProps } from '../../../lib/ui';
import s from './ReviewRow.module.css';

const DOT: Record<string, string> = {
  high: 'var(--vd-ok-fg)', medium: 'var(--vd-warn-fg)', low: 'var(--vd-bad-fg)',
};

export function ReviewRow({ c, selected, lead, compact, onSelect }: {
  c: CaseItem;
  selected?: boolean;
  /** A case is open beside the list: the row keeps only what picks the next
   *  one — who, how urgent, how long they have waited (DESIGN-REVIEW D15). */
  compact?: boolean;
  /** The worst case in the Breached group: the only row marked in red, so the
   *  one that genuinely needs attention first stands out (D13). */
  lead?: boolean;
  onSelect: () => void;
}) {
  const sla = c.submittedAt ? slaCountdown(c.submittedAt) : null;
  const concerns = c.flags.filter(f => f.severity !== 'info').length;
  const flags = concerns > 0 && (
    <span className={s.concerns}>
      <Icon name="alert" size={11} />
      {compact ? concerns : `${concerns} safety flag${concerns === 1 ? '' : 's'}`}
    </span>
  );
  return (
    <div
      {...pressProps(onSelect, caseRowLabel(c))}
      className={[s.row, selected && s.selected, lead && s.breached].filter(Boolean).join(' ')}
    >
      <span
        className={s.confidence}
        title={`AI confidence: ${c.confidence}`}
        style={{ background: DOT[c.confidence] ?? DOT.low }}
      />
      {compact ? (
        <div className={s.who}>
          <div className={s.patient}>{c.patient}</div>
          <div className={s.compactMeta}>
            <StatusPill status={c.rec.urgency} />
            {flags}
            <span className={s.waited}>{c.submittedAt ? waitAge(c.submittedAt) : c.meta}</span>
          </div>
        </div>
      ) : (
        <>
          <div className={s.who}>
            <div className={s.patient}>{c.patient}</div>
            <div className={s.dx}>{c.inferred?.[0] || c.demo}</div>
          </div>
          <div className={s.plan}>
            <div className={s.title}>{c.title}</div>
            <div className={s.tags}>
              {/* Two badges at most: what it is urgent, and what is unresolved.
                  The plan type is on the case itself (DESIGN-REVIEW D19). */}
              <StatusPill status={c.rec.urgency} />
              {flags}
            </div>
          </div>
          <div className={s.wait}>
            <div className={s.waitMain}>{c.submittedAt ? waitAge(c.submittedAt) : c.meta}</div>
            {sla && (
              <div className={s.sla} style={{ color: lead ? sla.tone : 'var(--vd-warn-fg)' }}>{sla.label}</div>
            )}
          </div>
        </>
      )}
      <Icon name="chevR" size={18} />
    </div>
  );
}
