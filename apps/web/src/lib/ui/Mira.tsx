// Mira visuals: the one voice surface (MC-1). State-animated presence sphere,
// plus the minimised floating glass puck it owns (MC-4) so modules never wrap
// it themselves. Durations come from the --vd-dur-* scale.
import { useBreakpoint } from '../../shell/viewport';
import { Icon } from './Primitives';
import s from './Mira.module.css';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const STATE_RING: Record<VoiceState, string> = {
  idle: 'var(--vd-state-idle)',
  listening: 'var(--vd-state-listen)',
  thinking: 'var(--vd-state-think)',
  speaking: 'var(--vd-state-speak)',
};

// Whole-sphere motion per state. Thinking moves the fluid layer only (see
// MiraOrb), so the core stays still while the mind swirls.
const SPHERE_ANIM: Record<VoiceState, string | undefined> = {
  idle: 'vd-breathe var(--vd-dur-orb-breathe) var(--vd-ease-spring) infinite',
  listening: 'vd-listen var(--vd-dur-orb-listen) var(--vd-ease-spring) infinite',
  thinking: undefined,
  speaking: 'vd-speak var(--vd-dur-orb-speak) var(--vd-ease-spring) infinite',
};

// The sphere itself: volumetric core + one counter-rotating fluid layer +
// glass highlight. Colors resolve from theme tokens (light + dark).
export function MiraOrb({ size = 138, voiceState = 'idle' }: { size?: number; voiceState?: VoiceState }) {
  return (
    <div
      className={s.orb}
      style={{ '--orb-size': `${size}px`, animation: SPHERE_ANIM[voiceState] } as React.CSSProperties}
    >
      <div
        className={s.fluid}
        style={{
          animation: voiceState === 'thinking'
            ? 'vd-swirl var(--vd-dur-orb-think) linear infinite'
            : 'vd-spin var(--vd-dur-orb-spin) linear infinite',
        }}
      >
        <div className={s.blobA} />
        <div className={`${s.blobB}${voiceState === 'speaking' ? ' ' + s.blobLoud : ''}`} />
      </div>
      <div className={s.gloss} />
    </div>
  );
}

// State-animated presence: ground shadow + dual staggered aura rings + sphere.
export function MiraPresence({
  voiceState = 'idle', size = 138, onTap, minimized = false, onMinimize, onMaximize, navOffset = false,
}: {
  voiceState?: VoiceState;
  size?: number;
  onTap?: () => void;
  /** Collapse into the floating glass puck (app-shell level, MC-4/MC-5). */
  minimized?: boolean;
  /** Shows a minimise control on the maximised presence. */
  onMinimize?: () => void;
  /** Tapping the puck maximises back into the consultation. */
  onMaximize?: () => void;
  /** Lift the puck above a bottom nav or sticky action bar on mobile. */
  navOffset?: boolean;
}) {
  const bp = useBreakpoint();
  const h = Math.round(size * 1.07);
  const ring = STATE_RING[voiceState];
  const ringAnim = voiceState === 'listening'
    ? 'vd-ring var(--vd-dur-ring) var(--vd-ease-out) infinite'
    : 'vd-ring var(--vd-dur-ring-slow) var(--vd-ease-out) infinite';

  if (minimized) {
    const puck = bp === 'mobile' ? 60 : 64;
    const orb = bp === 'mobile' ? 38 : 40;
    const edge = bp === 'mobile' ? 16 : bp === 'tablet' ? 24 : 28;
    return (
      <button
        type="button"
        className={`vd-glass ${s.puck}`}
        onClick={onMaximize ?? onTap}
        aria-label="Open Dr. Mira"
        style={{
          right: edge,
          bottom: navOffset && bp === 'mobile' ? 'calc(78px + env(safe-area-inset-bottom))' : `calc(${edge}px + env(safe-area-inset-bottom))`,
          width: puck, height: puck,
        }}
      >
        <MiraOrb size={orb} voiceState={voiceState} />
      </button>
    );
  }

  return (
    <div className={s.presence} style={{ width: size, height: h }}>
      <div className={s.ground} style={{ width: size * 0.84, height: Math.max(12, size * 0.14) }} />
      <div className={s.ring} style={{ inset: `0 0 ${h - size}px 0`, border: `1.5px solid ${ring}`, animation: ringAnim }} />
      {voiceState !== 'idle' && (
        <div
          className={`${s.ring} ${s.ringEcho}`}
          style={{ inset: `0 0 ${h - size}px 0`, border: `1px solid ${ring}`, animation: `${ringAnim.split(' ')[0]} 2.8s ease-out 1.4s infinite` }}
        />
      )}
      <div className={s.tap} onClick={onTap} style={{ cursor: onTap ? 'pointer' : 'default' }}>
        <MiraOrb size={size} voiceState={voiceState} />
      </div>
      {onMinimize && (
        <button
          type="button"
          className={`vd-glass ${s.minimise}`}
          onClick={onMinimize}
          aria-label="Minimise Dr. Mira"
        >
          <Icon name="chevD" size={18} />
        </button>
      )}
    </div>
  );
}
