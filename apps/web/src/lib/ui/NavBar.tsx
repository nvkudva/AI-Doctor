// The one navigation component (DESIGN §10.1, §10.8). Same items, three forms:
//   mobile   — horizontal glass pill fixed at the bottom, orb in the centre
//   tablet   — 76px vertical icon rail, orb pinned at the bottom
//   desktop  — 248px labelled sidebar, collapsible back to the icon rail
// In either vertical form the `railTop` item floats to the top of the rail.
import { useSyncExternalStore } from 'react';
import { Icon, pressProps, type IconName } from './Primitives';
import { MiraOrb, STATE_RING, type VoiceState } from './Mira';
import { gradients, ink, lines, nav as navTone, radius, space, type, z } from '../theme';
import { useBreakpoint } from '../../shell/viewport';

export interface NavItem {
  key: string;
  label: string;
  icon: IconName;
}

/** Scroll padding a screen needs so its last row clears the bottom bar. */
export const bottomBarInset = 'calc(110px + env(safe-area-inset-bottom))';

const COLLAPSE_KEY = 'vd_nav_collapsed';

// Module-level so <MiraPanel> can anchor beside the rail at whatever width the
// rail currently is, without the modules having to thread the state through.
let collapsed = (() => {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
})();
const listeners = new Set<() => void>();

function setCollapsed(v: boolean) {
  collapsed = v;
  try { localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0'); } catch { /* private mode */ }
  listeners.forEach(f => f());
}

function subscribe(f: () => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

function useCollapsed(): boolean {
  return useSyncExternalStore(subscribe, () => collapsed, () => false);
}

/** Distance from the viewport's left edge to the rail's right edge. 0 on mobile. */
export function useRailOffset(): number {
  const bp = useBreakpoint();
  const isCollapsed = useCollapsed();
  if (bp === 'mobile') return 0;
  const gutter = bp === 'desktop' ? 20 : 16;
  return gutter + (bp === 'desktop' && !isCollapsed ? 248 : 76);
}

export function NavBar({ items, active, onSelect, orb, railTop }: {
  /** Exactly four. On mobile the first two sit left of the orb, the last two right. */
  items: NavItem[];
  active: string;
  onSelect: (key: string) => void;
  /** The centre FAB on mobile, the bottom FAB in the rail. */
  orb: { label: string; onClick: () => void; voiceState?: VoiceState };
  /** Key of the item that leads the rail — the profile entry in both modules. */
  railTop?: string;
}) {
  const bp = useBreakpoint();
  const collapsed = useCollapsed();
  if (bp === 'mobile') return <BottomBar items={items} active={active} onSelect={onSelect} orb={orb} />;
  const wide = bp === 'desktop' && !collapsed;
  const ordered = railTop
    ? [...items].sort((a, b) => Number(b.key === railTop) - Number(a.key === railTop))
    : items;
  return (
    <nav
      className="vd-glass"
      aria-label="Primary"
      style={{
        position: 'sticky', top: bp === 'desktop' ? 20 : 16, alignSelf: 'flex-start',
        width: wide ? 248 : 76, flex: 'none',
        height: `calc(100dvh - ${bp === 'desktop' ? 40 : 32}px)`,
        borderRadius: radius['2xl'], padding: wide ? 16 : 14,
        display: 'flex', flexDirection: 'column', alignItems: wide ? 'stretch' : 'center',
        gap: space[2], transition: 'width var(--vd-dur-3) var(--vd-ease-spring)',
      }}
    >
      {bp === 'desktop' && (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={wide ? 'Collapse navigation' : 'Expand navigation'}
          aria-expanded={wide}
          style={{
            alignSelf: wide ? 'flex-end' : 'center', width: 32, height: 32, borderRadius: radius.pill,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            border: `1px solid ${lines.glass}`, background: 'transparent', color: ink.secondary,
            transform: wide ? 'rotate(90deg)' : 'rotate(-90deg)',
          }}
        >
          <Icon name="chevD" size={16} />
        </button>
      )}

      {ordered.map(i => <RailItem key={i.key} item={i} active={active === i.key} wide={wide} onSelect={onSelect} />)}

      <div style={{ flex: 1 }} />

      <div
        {...pressProps(orb.onClick, orb.label)}
        style={{
          display: 'flex', alignItems: 'center', gap: space[4], cursor: 'pointer',
          alignSelf: wide ? 'stretch' : 'center', padding: wide ? `0 ${space[4]}px 0 4px` : 0,
          height: 56, borderRadius: radius['2xl'],
          background: wide ? gradients.call : 'transparent',
          boxShadow: wide ? 'var(--vd-shadow-cta), var(--vd-glass-hi)' : 'none',
          color: 'var(--vd-ink-on-brand)', WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{
          position: 'relative', flex: 'none', width: 48, height: 48, borderRadius: radius.pill,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: wide ? 'transparent' : gradients.call,
          border: wide ? 'none' : '1px solid var(--vd-glass-border)',
          boxShadow: wide ? 'none' : 'var(--vd-shadow-cta), var(--vd-glass-hi)',
        }}>
          <VoiceAura state={orb.voiceState ?? 'idle'} />
          <MiraOrb size={32} voiceState={orb.voiceState ?? 'idle'} />
        </span>
        {wide && <span style={{ ...type.subheadD, fontWeight: 700 }}>{orb.label}</span>}
      </div>
    </nav>
  );
}

function RailItem({ item, active, wide, onSelect }: {
  item: NavItem; active: boolean; wide: boolean; onSelect: (key: string) => void;
}) {
  return (
    <div
      {...pressProps(() => onSelect(item.key), item.label)}
      aria-current={active ? 'page' : undefined}
      title={wide ? undefined : item.label}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: wide ? 'flex-start' : 'center',
        gap: space[4], alignSelf: wide ? 'stretch' : 'center',
        width: wide ? undefined : 48, height: 48, padding: wide ? `0 ${space[4]}px` : 0,
        borderRadius: wide ? radius.lg : radius.pill, cursor: 'pointer',
        background: active ? 'var(--vd-selected-ring)' : 'transparent',
        color: active ? navTone.active : navTone.idle,
        WebkitTapHighlightColor: 'transparent',
        transition: 'background var(--vd-dur-2) var(--vd-ease-spring)',
      }}
    >
      <Icon name={item.icon} size={22} />
      {wide && (
        <span style={{ ...type.subheadD, fontWeight: active ? 700 : 600, whiteSpace: 'nowrap' }}>{item.label}</span>
      )}
    </div>
  );
}

function BottomBar({ items, active, onSelect, orb }: {
  items: NavItem[];
  active: string;
  onSelect: (key: string) => void;
  orb: { label: string; onClick: () => void; voiceState?: VoiceState };
}) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: z.nav, padding: '0 14px calc(16px + env(safe-area-inset-bottom))' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 372, margin: '0 auto' }}>
        <nav
          className="vd-glass"
          aria-label="Primary"
          style={{
            height: 62, borderRadius: radius['2xl'], boxShadow: 'var(--vd-glass-hi), var(--vd-elev-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${space[1]}px`,
          }}
        >
          {items.slice(0, 2).map(i => <Tab key={i.key} item={i} active={active === i.key} onSelect={onSelect} />)}
          {/* Clears the FAB's icon row; labels sit below its lower edge. */}
          <div style={{ flex: 'none', width: 56 }} />
          {items.slice(2).map(i => <Tab key={i.key} item={i} active={active === i.key} onSelect={onSelect} />)}
        </nav>
        <div
          {...pressProps(orb.onClick, orb.label)}
          style={{
            position: 'absolute', left: '50%', top: -30, transform: 'translateX(-50%)',
            width: 62, height: 62, borderRadius: radius.pill, cursor: 'pointer', background: gradients.call,
            border: '1px solid var(--vd-glass-border)', boxShadow: 'var(--vd-shadow-cta), var(--vd-glass-hi)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent',
          }}
        >
          <VoiceAura state={orb.voiceState ?? 'idle'} />
          <MiraOrb size={34} voiceState={orb.voiceState ?? 'idle'} />
        </div>
      </div>
    </div>
  );
}

// Expanding rings behind the nav orb, so a live session reads from the bar
// itself — the panel no longer carries an orb of its own. It never stops: at
// rest it is one slow ring, so the orb always reads as alive.
function VoiceAura({ state }: { state: VoiceState }) {
  const idle = state === 'idle';
  const dur = idle ? 'var(--vd-dur-ring-rest)'
    : state === 'listening' ? 'var(--vd-dur-ring)'
      : 'var(--vd-dur-ring-slow)';
  return (
    <>
      {(idle ? [0] : [0, 1]).map(i => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, borderRadius: radius.pill, pointerEvents: 'none',
            border: `${idle ? 1 : 2}px solid ${STATE_RING[state]}`,
            opacity: idle ? 0.6 : 1,
            animation: `vd-ring ${dur} var(--vd-ease-out) infinite`,
            animationDelay: i ? `calc(${dur} / 2)` : '0s',
          }}
        />
      ))}
    </>
  );
}

function Tab({ item, active, onSelect }: { item: NavItem; active: boolean; onSelect: (key: string) => void }) {
  return (
    <div
      {...pressProps(() => onSelect(item.key), item.label)}
      aria-current={active ? 'page' : undefined}
      style={{
        flex: 1, minWidth: 0, minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        cursor: 'pointer', padding: '8px 0', color: active ? navTone.active : navTone.idle,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon name={item.icon} size={22} />
      <div style={{
        ...type.caption, fontSize: 10, letterSpacing: 0, fontWeight: active ? 700 : 600, maxWidth: '100%',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        transition: 'color var(--vd-dur-2) var(--vd-ease-spring)',
      }}>
        {item.label}
      </div>
    </div>
  );
}
