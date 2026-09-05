// The shared screen header (DESIGN §11.1): large title, optional subtitle or
// badge, 44 circular glass actions on the right, sticky glass-thin at ≥800.
// Patient home/records and the doctor desk render this same component.
import { useState } from 'react';
import { getTheme, gradients, ink, lines, radius, setTheme, type, z, type Theme } from '../theme';
import { useBreakpoint } from '../../shell/viewport';
import { IconButton } from './Button';

/** "Good evening, Sara" — the title both modules show on their landing screen. */
export function greeting(name?: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = (name || '').replace(/^Dr\.\s*/, '').split(' ')[0] || 'there';
  return `${part}, ${first}`;
}

/** Light/dark switch. Sits in every header, left of the notification bell. */
export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  return (
    <IconButton
      icon={theme === 'light' ? 'moon' : 'sun'}
      label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={() => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        setThemeState(next);
      }}
    />
  );
}

function initialsOf(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '•';
}

export function AppHeader({
  title, subtitle, badge, actions, identity, sticky = true, style,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Rendered beside the title — e.g. a pending-count pill. */
  badge?: React.ReactNode;
  /** Action buttons, right-aligned. Order is Sign out · <ThemeToggle> · bell. */
  actions?: React.ReactNode;
  /** Profile screens lead with the account instead of a title. */
  identity?: { name: string; email: string };
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
        ...(identity && mobile ? { flexDirection: 'column-reverse', alignItems: 'stretch' } : {}),
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
      {identity ? (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            flex: 'none', width: mobile ? 44 : 52, height: mobile ? 44 : 52, borderRadius: radius.pill,
            background: gradients.primary, color: 'var(--vd-ink-on-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...(mobile ? type.callout : type.headline), fontWeight: 700,
          }}>
            {initialsOf(identity.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...(mobile ? type.title : type.titleT), color: ink.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {identity.name}
            </div>
            <div style={{ ...type.footnote, color: ink.soft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {identity.email}
            </div>
          </div>
        </div>
      ) : (
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
      )}
      {actions && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 'none',
          ...(identity && mobile ? { justifyContent: 'flex-end' } : {}),
        }}>
          {actions}
        </div>
      )}
    </header>
  );
}
