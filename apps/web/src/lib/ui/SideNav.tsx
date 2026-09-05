// Tablet/desktop navigation (DESIGN §10.1): a 76px icon rail at tablet, a
// 248px labelled sidebar at desktop. Glass, sticky, items from an array.
// Replaces the bottom nav (and its FAB) above 800.
import { ink, nav, radius, type } from '../theme';
import { useBreakpoint } from '../../shell/viewport';
import { Icon, type IconName } from './Primitives';
import { Button, IconButton } from './Button';

export interface SideNavItem {
  key: string;
  label: string;
  icon: IconName;
}

export function SideNav({
  items, active, onSelect, action, account, style,
}: {
  items: SideNavItem[];
  active: string;
  onSelect: (key: string) => void;
  /** Primary entry pinned at the top — the consult CTA replacing the FAB. */
  action?: { label: string; icon?: IconName; onClick: () => void };
  /** Pinned at the bottom — pass <AccountMenu>. */
  account?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const bp = useBreakpoint();
  if (bp === 'mobile') return null;
  const wide = bp === 'desktop';
  return (
    <nav
      className="vd-glass"
      aria-label="Primary"
      style={{
        position: 'sticky', top: wide ? 20 : 16, alignSelf: 'flex-start',
        width: wide ? 248 : 76, flex: 'none',
        height: `calc(100dvh - ${wide ? 40 : 32}px)`,
        borderRadius: radius['2xl'],
        padding: wide ? 16 : 14,
        display: 'flex', flexDirection: 'column', alignItems: wide ? 'stretch' : 'center',
        gap: wide ? 4 : 8,
        ...style,
      }}
    >
      {action && (
        <div style={{ marginBottom: wide ? 12 : 10, display: 'flex', justifyContent: 'center' }}>
          {wide
            ? <Button variant="primary" icon={action.icon} onClick={action.onClick} fullWidth style={{ height: 48 }}>{action.label}</Button>
            : <IconButton icon={action.icon ?? 'mic'} label={action.label} onClick={action.onClick} tone="plain" style={{ background: 'var(--vd-brand-2)', color: 'var(--vd-ink-on-brand)', boxShadow: 'var(--vd-shadow-cta)' }} />}
        </div>
      )}
      {items.map(it => {
        const on = it.key === active;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onSelect(it.key)}
            aria-current={on ? 'page' : undefined}
            title={wide ? undefined : it.label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: wide ? 'flex-start' : 'center',
              gap: 10, height: 44, width: wide ? '100%' : 44, padding: wide ? '0 12px' : 0,
              borderRadius: radius.sm, border: '1px solid transparent', cursor: 'pointer',
              background: on ? 'var(--vd-surface-card)' : 'transparent',
              color: on ? nav.active : nav.idle,
              boxShadow: on ? 'var(--vd-elev-1)' : 'none',
              transition: 'background var(--vd-dur-2) var(--vd-ease-spring), color var(--vd-dur-2) var(--vd-ease-spring)',
            }}
          >
            <Icon name={it.icon} size={wide ? 20 : 22} />
            {wide && <span style={{ ...type.subhead, color: on ? nav.active : ink.body }}>{it.label}</span>}
          </button>
        );
      })}
      {account && (
        <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', justifyContent: wide ? 'flex-start' : 'center' }}>
          {account}
        </div>
      )}
    </nav>
  );
}
