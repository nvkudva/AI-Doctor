// Solid content surfaces (DESIGN §8.2 — glass floats, solid holds content)
// and the shared empty state built on top of one.
import { ink, lines, radius, surfaces, type } from '../theme';
import { useBreakpoint } from '../../shell/viewport';
import { Icon, type IconName } from './Primitives';

export function Card({
  children, tone = 'card', level = 2, pad, bordered = true, onClick, selected, className, style,
}: {
  children: React.ReactNode;
  tone?: 'card' | 'panel' | 'raised';
  /** Elevation step 0–5. */
  level?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Override the per-breakpoint padding (16 / 20 / 24). */
  pad?: number | string;
  bordered?: boolean;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const bp = useBreakpoint();
  const padding = pad ?? (bp === 'mobile' ? 16 : bp === 'tablet' ? 20 : 24);
  const bg = tone === 'panel' ? surfaces.panel : tone === 'raised' ? surfaces.raised : surfaces.card;
  return (
    <div
      className={className}
      onClick={onClick}
      {...(onClick ? { role: 'button', tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      } } : {})}
      style={{
        background: bg,
        padding,
        borderRadius: bp === 'mobile' ? radius.md : radius.lg,
        border: `1px solid ${selected ? lines.selected : bordered ? lines.hairline : 'transparent'}`,
        boxShadow: `var(--vd-elev-${level})`,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Centred empty state: 88 icon disc, headline + callout, optional action.
export function EmptyState({
  icon, title, body, action, style,
}: {
  icon?: IconName | React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const bp = useBreakpoint();
  const glyph = typeof icon === 'string'
    ? (
      <div style={{
        width: 88, height: 88, borderRadius: radius.pill, background: surfaces.panel,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: ink.secondary,
      }}>
        <Icon name={icon as IconName} size={34} />
      </div>
    )
    : icon;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', gap: 12, padding: '40px 20px', ...style,
    }}>
      {glyph}
      <div style={{ ...(bp === 'mobile' ? type.headline : type.headlineT), color: ink.primary }}>{title}</div>
      {body && (
        <div style={{ ...(bp === 'mobile' ? type.callout : type.calloutT), color: ink.soft, maxWidth: '38ch' }}>
          {body}
        </div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
