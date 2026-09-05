// The one navigation component (DESIGN §10.1, §10.8). Same items, three forms:
//   mobile   — horizontal glass pill fixed at the bottom, orb in the centre
//   tablet   — 76px vertical icon rail, orb pinned at the bottom
//   desktop  — 248px labelled sidebar, collapsible back to the icon rail
// In either vertical form the `railTop` item floats to the top of the rail.
import { useSyncExternalStore } from 'react';
import { Icon, pressProps, type IconName } from './Primitives';
import { MiraOrb, STATE_RING, type VoiceState } from './Mira';
import { useBreakpoint } from '../../shell/viewport';
import s from './NavBar.module.css';

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
    <nav className={`vd-glass ${s.rail} ${wide ? s.wide : s.narrow}`} aria-label="Primary">
      {bp === 'desktop' && (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={wide ? 'Collapse navigation' : 'Expand navigation'}
          aria-expanded={wide}
          className={`${s.collapse}${wide ? ' ' + s.collapseWide : ''}`}
        >
          <Icon name="chevD" size={16} />
        </button>
      )}

      {ordered.map(i => <RailItem key={i.key} item={i} active={active === i.key} wide={wide} onSelect={onSelect} />)}

      <div className={s.spacer} />

      <div {...pressProps(orb.onClick, orb.label)} className={`${s.orbRow}${wide ? ' ' + s.orbRowWide : ''}`}>
        <span className={`${s.orbDisc}${wide ? ' ' + s.orbDiscWide : ''}`}>
          <VoiceAura state={orb.voiceState ?? 'idle'} />
          <MiraOrb size={32} voiceState={orb.voiceState ?? 'idle'} />
        </span>
        {wide && <span className={s.orbLabel}>{orb.label}</span>}
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
      className={[s.item, wide && s.itemWide, active && s.itemActive].filter(Boolean).join(' ')}
    >
      <Icon name={item.icon} size={22} />
      {wide && (
        <span className={`${s.itemLabel}${active ? ' ' + s.itemLabelActive : ''}`}>{item.label}</span>
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
    <div className={s.dock}>
      <div className={s.dockInner}>
        <nav className={`vd-glass ${s.bar}`} aria-label="Primary">
          {items.slice(0, 2).map(i => <Tab key={i.key} item={i} active={active === i.key} onSelect={onSelect} />)}
          <div className={s.fabGap} />
          {items.slice(2).map(i => <Tab key={i.key} item={i} active={active === i.key} onSelect={onSelect} />)}
        </nav>
        <div {...pressProps(orb.onClick, orb.label)} className={s.fab}>
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
          className={s.aura}
          style={{
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
      className={`${s.tab}${active ? ' ' + s.tabActive : ''}`}
    >
      <Icon name={item.icon} size={22} />
      <div className={`${s.tabLabel}${active ? ' ' + s.tabLabelActive : ''}`}>{item.label}</div>
    </div>
  );
}
