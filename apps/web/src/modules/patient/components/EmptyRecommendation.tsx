// Shown when the recommendation route has no plan (e.g. deep link).
import { pressProps } from '../../../lib/ui';

export function EmptyRecommendation({ onHome }: { onHome: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 26, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--vd-ink-1)' }}>No plan to show yet</div>
      <div style={{ fontSize: 13.5, color: 'var(--vd-ink-3)' }}>Finish a consult and your plan will appear here.</div>
      <div {...pressProps(onHome, 'Back home')} style={{ cursor: 'pointer', borderRadius: 99, height: 48, padding: '0 24px', display: 'inline-flex', alignItems: 'center', background: 'var(--vd-surface-card)', fontSize: 13.5, fontWeight: 700, color: 'var(--vd-ink-2)' }}>
        Back home
      </div>
    </div>
  );
}
