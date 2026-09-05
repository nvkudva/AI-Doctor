// Mobile-only glass pill nav (DESIGN §10.1): four tabs + centre consult FAB.
// At ≥800 <SideNav> replaces it, so this renders nothing there.
import { Icon, pressProps } from '../../lib/ui';
import { gradients, nav, radius, type, z } from '../../lib/theme';
import { useIsMobile } from '../../shell/viewport';

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
  const mobile = useIsMobile();
  if (!mobile) return null;
  const left: NavTab[] = ['home', 'history'];
  const right: NavTab[] = ['labs', 'profile'];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: z.nav, padding: '0 18px calc(20px + env(safe-area-inset-bottom))' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 352, margin: '0 auto' }}>
        <div className="vd-glass" style={{ position: 'relative', height: 62, borderRadius: radius.pill }}>
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
            width: 62, height: 62, borderRadius: radius.pill, cursor: 'pointer', background: gradients.call,
            border: '1px solid var(--vd-glass-border)',
            boxShadow: 'var(--vd-shadow-cta), var(--vd-glass-hi)',
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
  return (
    <div
      {...pressProps(() => onTab(tab), LABELS[tab])}
      aria-current={active ? 'page' : undefined}
      style={{
        flex: 1, minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        cursor: 'pointer', padding: '8px 0', color: active ? nav.active : nav.idle,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon name={ICONS[tab]} size={23} />
      <div style={{ ...type.caption, fontWeight: active ? 700 : 600, transition: 'color var(--vd-dur-2) var(--vd-ease-spring)' }}>{LABELS[tab]}</div>
    </div>
  );
}
