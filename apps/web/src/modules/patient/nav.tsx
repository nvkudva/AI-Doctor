import { Icon, pressProps } from '@vd/ui';
import { gradients, nav, z } from '@vd/theme';

export type NavTab = 'home' | 'history' | 'labs' | 'profile';

const ICONS: Record<NavTab, 'home' | 'clock' | 'drop' | 'person'> = {
  home: 'home',
  history: 'clock',
  labs: 'drop',
  profile: 'person',
};

const LABELS: Record<NavTab, string> = { home: 'Home', history: 'History', labs: 'Labs', profile: 'Profile' };

export function BottomNav({ active, onTab, onCall }: {
  active: NavTab | '';
  onTab: (t: NavTab) => void;
  onCall: () => void;
}) {
  const left: NavTab[] = ['home', 'history'];
  const right: NavTab[] = ['labs', 'profile'];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: z.nav, padding: '0 18px calc(20px + env(safe-area-inset-bottom))' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 352, margin: '0 auto' }}>
        <div
          style={{
            position: 'relative', height: 62, borderRadius: 32, background: gradients.glassBar,
            backdropFilter: 'var(--vd-glass-blur)', WebkitBackdropFilter: 'var(--vd-glass-blur)',
            border: '1px solid var(--vd-glass-border)',
            boxShadow: '0 14px 34px oklch(0.45 0.12 295 / .3), 0 2px 8px rgba(46,37,71,.14), var(--vd-glass-hi)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 18px' }}>
            {left.map(t => <NavItem key={t} tab={t} active={active === t} onTab={onTab} />)}
            <div style={{ flex: 'none', width: 72 }} />
            {right.map(t => <NavItem key={t} tab={t} active={active === t} onTab={onTab} />)}
          </div>
        </div>
        <div
          {...pressProps(onCall, 'Start consultation')}
          style={{
            position: 'absolute', left: '50%', top: -30, transform: 'translateX(-50%)',
            width: 62, height: 62, borderRadius: '50%', cursor: 'pointer', background: gradients.call,
            border: '1px solid var(--vd-glass-border)',
            boxShadow: 'var(--vd-shadow-cta),inset 0 1.5px 1px rgba(255,255,255,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vd-ink-on-brand)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Icon name="phone" size={27} />
        </div>
      </div>
    </div>
  );
}

function NavItem({ tab, active, onTab }: { tab: NavTab; active: boolean; onTab: (t: NavTab) => void }) {
  const color = active ? nav.active : nav.muted;
  return (
    <div
      {...pressProps(() => onTab(tab), LABELS[tab])}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '8px 0', color, WebkitTapHighlightColor: 'transparent' }}
    >
      <Icon name={ICONS[tab]} size={23} />
      <div style={{ fontSize: 11, fontWeight: active ? 700 : 600, transition: 'color .2s' }}>{LABELS[tab]}</div>
    </div>
  );
}
