// The shared screen header (DESIGN §11.1): large title, optional subtitle or
// badge, 44 circular glass actions on the right, sticky glass-thin at ≥800.
// Patient home/records and the doctor desk render this same component.
import { ink, lines, type, z } from '../theme';
import { useBreakpoint } from '../../shell/viewport';

/** "Good evening, Sara" — the title both modules show on their landing screen. */
export function greeting(name?: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = (name || '').replace(/^Dr\.\s*/, '').split(' ')[0] || 'there';
  return `${part}, ${first}`;
}

export function AppHeader({
  title, subtitle, badge, actions, sticky = true, style,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Rendered beside the title — e.g. a pending-count pill. */
  badge?: React.ReactNode;
  /** Action buttons, right-aligned. */
  actions?: React.ReactNode;
  sticky?: boolean;
  style?: React.CSSProperties;
}) {
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const glassy = sticky && !mobile;
  const titleType = mobile ? type.largeTitle : bp === 'tablet' ? type.largeTitleT : type.largeTitleD;
  return (
    <header
      className={glassy ? 'vd-glass-thin' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        minHeight: mobile ? 64 : bp === 'tablet' ? 72 : 76,
        ...(glassy
          ? {
            position: 'sticky', top: 0, zIndex: z.header, borderRadius: 0,
            border: 'none', borderBottom: `1px solid ${lines.glass}`, boxShadow: 'var(--vd-elev-1)',
          }
          : {}),
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ ...titleType, color: ink.primary, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          {badge}
        </div>
        {subtitle && (
          <div style={{ ...(mobile ? type.callout : type.calloutT), color: ink.soft, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>{actions}</div>}
    </header>
  );
}
