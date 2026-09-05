// One review-queue row: patient, complaint, wait time, status.
import type { CaseItem } from '../../../lib/core';
import { pressProps, StatusPill } from '../../../lib/ui';
import { ink, surfaces, type } from '../../../lib/theme';
import { waitAge, waitTone } from './relativeTime';

export function QueueCard({ c, selected, onSelect }: { c: CaseItem; selected?: boolean; onSelect: () => void }) {
  return (
    <div
      {...pressProps(onSelect, `Review ${c.patient} — ${c.title}`)}
      style={{
        cursor: 'pointer', padding: '13px 14px', borderRadius: 16,
        border: `1.5px solid ${selected ? 'oklch(0.6 0.2 290 / .7)' : 'transparent'}`,
        background: selected ? surfaces.card : 'color-mix(in srgb, var(--vd-surface-card) 60%, transparent)',
        boxShadow: selected ? '0 10px 24px rgba(12,20,60,.28)' : '0 3px 10px rgba(12,20,60,.14)',
      }}
    >
      <div style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>{c.patient}</div>
      <div style={{ fontSize: 12, color: ink.secondary }}>{c.title}</div>
      {(c.inferred?.[0] || c.summary) && (
        <div style={{ fontSize: 12, color: ink.secondary, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.inferred?.[0] || c.summary}
        </div>
      )}
      <div style={{ fontSize: 11, color: ink.muted, marginTop: 2 }}>
        {c.meta}{c.submittedAt ? (
          <> · waiting <b style={{ color: waitTone(c.submittedAt) }}>{waitAge(c.submittedAt)}</b></>
        ) : ''}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span title={`AI confidence: ${c.confidence}`} style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: c.confidence === 'high' ? 'var(--vd-ok-fg)' : c.confidence === 'medium' ? 'var(--vd-warn-fg)' : 'var(--vd-bad-fg)' }} />
        <StatusPill status={c.status} />
        {c.rec.urgency === 'urgent' && (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 99, background: 'var(--vd-bad-bg)', color: 'var(--vd-bad-fg)', boxShadow: '0 0 10px var(--vd-bad-bg)' }}>
            Urgent
          </span>
        )}
        {c.rec.urgency === 'soon' && (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 99, background: 'var(--vd-warn-bg)', color: 'var(--vd-warn-fg)' }}>
            Soon
          </span>
        )}
      </div>
    </div>
  );
}
