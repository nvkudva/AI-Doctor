// One review-queue row: patient, complaint, wait time, status.
import type { CaseItem } from '../../../lib/core';
import { Card, StatusPill } from '../../../lib/ui';
import { ink, media, space, type } from '../../../lib/theme';
import { waitAge, waitTone } from './relativeTime';

// Injected once by DoctorApp — min-height per breakpoint plus the fine-pointer
// hover lift (DESIGN §10.6).
export const queueCardCss = `
.vd-qcard{min-height:96px}
${media.tabletUp}{.vd-qcard{min-height:104px}}
@media (pointer:fine){
  .vd-qcard{transition:box-shadow var(--vd-dur-2) var(--vd-ease-spring),border-color var(--vd-dur-2) var(--vd-ease-spring)}
  .vd-qcard:hover{border-color:color-mix(in srgb,var(--vd-selected-ring) 30%,transparent)}
  .vd-qcard:hover:not(.vd-qcard-urgent){box-shadow:var(--vd-elev-3)}
}`;

export function QueueCard({ c, selected, onSelect }: { c: CaseItem; selected?: boolean; onSelect: () => void }) {
  const level = selected ? 3 : 2;
  const urgent = c.rec.urgency === 'urgent';
  return (
    <Card
      className={urgent ? 'vd-qcard vd-qcard-urgent' : 'vd-qcard'}
      level={level}
      selected={selected}
      onClick={onSelect}
      pad={16}
      style={{
        display: 'flex', flexDirection: 'column', gap: space[1],
        boxShadow: urgent ? `var(--vd-elev-${level}), var(--vd-urgent-glow)` : `var(--vd-elev-${level})`,
      }}
    >
      <div style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>{c.patient}</div>
      <div style={{ ...type.footnote, color: ink.secondary }}>{c.title}</div>
      {(c.inferred?.[0] || c.summary) && (
        <div style={{ ...type.footnote, color: ink.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.inferred?.[0] || c.summary}
        </div>
      )}
      <div style={{ ...type.caption, fontWeight: 400, color: ink.muted }}>
        {c.meta}{c.submittedAt ? (
          <> · waiting <b style={{ color: waitTone(c.submittedAt) }}>{waitAge(c.submittedAt)}</b></>
        ) : ''}
      </div>
      <div style={{ display: 'flex', gap: space[2], marginTop: space[1], alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          title={`AI confidence: ${c.confidence}`}
          style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: c.confidence === 'high' ? 'var(--vd-ok-fg)' : c.confidence === 'medium' ? 'var(--vd-warn-fg)' : 'var(--vd-bad-fg)' }}
        />
        <StatusPill status={c.status} />
        {(urgent || c.rec.urgency === 'soon') && <StatusPill status={c.rec.urgency} />}
      </div>
    </Card>
  );
}
