// The shared screen header (DESIGN §11.1): large title, optional subtitle or
// badge, 44 circular glass actions on the right. No background of its own, so
// it sits on the module's ground identically in both apps.
import { useState } from 'react';
import { getTheme, setTheme, type Theme } from '../theme';
import { IconButton } from './Button';
import s from './AppHeader.module.css';

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
  title, subtitle, badge, actions, identity, className, style,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Rendered beside the title — e.g. a pending-count pill. */
  badge?: React.ReactNode;
  /** Action buttons, right-aligned. Order is Sign out · <ThemeToggle> · bell. */
  actions?: React.ReactNode;
  /** Profile screens lead with the account instead of a title. */
  identity?: { name: string; email: string };
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <header
      className={[s.header, identity && s.stacked, className].filter(Boolean).join(' ')}
      style={style}
    >
      {identity ? (
        <div className={s.identity}>
          <div className={s.avatar}>{initialsOf(identity.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className={s.name}>{identity.name}</div>
            <div className={s.email}>{identity.email}</div>
          </div>
        </div>
      ) : (
        <div className={s.titleBlock}>
          <div className={s.titleRow}>
            <div className={s.title}>{title}</div>
            {badge}
          </div>
          {subtitle && <div className={s.subtitle}>{subtitle}</div>}
        </div>
      )}
      {actions && (
        <div className={`${s.actions}${identity ? ' ' + s.actionsStacked : ''}`}>{actions}</div>
      )}
    </header>
  );
}
