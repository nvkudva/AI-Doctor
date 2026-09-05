// Mira visuals: the one voice surface (MC-1). State-animated presence sphere,
// plus the minimised floating glass puck it owns (MC-4) so modules never wrap
// it themselves. Durations come from the --vd-dur-* scale.
import { radius, z } from '../theme';
import { useBreakpoint } from '../../shell/viewport';
import { Icon } from './Primitives';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATE_RING: Record<VoiceState, string> = {
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
      style={{
        position: 'relative', width: size, height: size, fontSize: size, borderRadius: '50%', overflow: 'hidden',
        background: 'radial-gradient(circle at 35% 28%,rgba(255,255,255,.95),rgba(255,255,255,0) 42%),radial-gradient(circle at 50% 55%,var(--vd-orb-mid),var(--vd-orb-deep) 78%)',
        boxShadow: 'var(--vd-orb-shadow),inset 0 -0.116em 0.188em rgba(20,10,60,.35),inset 0 0.0725em 0.116em rgba(255,255,255,.55),inset 0 0 0 1px rgba(255,255,255,.85)',
        animation: SPHERE_ANIM[voiceState],
      }}
    >
      <div
        style={{
          position: 'absolute', inset: '-20%',
          animation: voiceState === 'thinking'
            ? 'vd-swirl var(--vd-dur-orb-think) linear infinite'
            : 'vd-spin var(--vd-dur-orb-spin) linear infinite',
        }}
      >
        <div style={{ position: 'absolute', top: '8%', left: '10%', width: '68%', height: '68%', borderRadius: '50%', background: 'var(--vd-orb-mid)', filter: 'blur(0.14em)', opacity: 0.85 }} />
        <div style={{ position: 'absolute', bottom: '4%', right: '6%', width: '58%', height: '58%', borderRadius: '50%', background: 'var(--vd-orb-warm)', filter: 'blur(0.16em)', opacity: voiceState === 'speaking' ? 0.95 : 0.7 }} />
      </div>
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle at 32% 20%,rgba(255,255,255,.85),rgba(255,255,255,0) 40%),conic-gradient(from 200deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,.22) 40deg,rgba(255,255,255,0) 90deg)',
        }}
      />
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
        className="vd-glass"
        onClick={onMaximize ?? onTap}
        aria-label="Open Dr. Mira"
        style={{
          position: 'fixed', right: edge, zIndex: z.nav, cursor: 'pointer',
          bottom: navOffset && bp === 'mobile' ? 'calc(78px + env(safe-area-inset-bottom))' : `calc(${edge}px + env(safe-area-inset-bottom))`,
          width: puck, height: puck, borderRadius: radius.pill, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'vd-pop var(--vd-dur-4) var(--vd-ease-overshoot) both',
        }}
      >
        <MiraOrb size={orb} voiceState={voiceState} />
      </button>
    );
  }

  return (
    <div style={{ position: 'relative', width: size, height: h, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', flex: 'none' }}>
      <div
        style={{
          position: 'absolute', left: '50%', bottom: -2, transform: 'translateX(-50%)',
          width: size * 0.84, height: Math.max(12, size * 0.14), borderRadius: '50%',
          background: 'var(--vd-orb-ground)', filter: 'blur(4px)',
        }}
      />
      <div style={{ position: 'absolute', inset: `0 0 ${h - size}px 0`, borderRadius: '50%', border: `1.5px solid ${ring}`, animation: ringAnim }} />
      {voiceState !== 'idle' && (
        <div style={{ position: 'absolute', inset: `0 0 ${h - size}px 0`, borderRadius: '50%', border: `1px solid ${ring}`, opacity: 0.6, animation: `${ringAnim.split(' ')[0]} 2.8s ease-out 1.4s infinite` }} />
      )}
      <div onClick={onTap} style={{ cursor: onTap ? 'pointer' : 'default', borderRadius: '50%' }}>
        <MiraOrb size={size} voiceState={voiceState} />
      </div>
      {onMinimize && (
        <button
          type="button"
          className="vd-glass"
          onClick={onMinimize}
          aria-label="Minimise Dr. Mira"
          style={{
            position: 'absolute', right: -6, bottom: 0, width: 44, height: 44, padding: 0,
            borderRadius: radius.pill, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--vd-ink-on-glass)',
          }}
        >
          <Icon name="chevD" size={18} />
        </button>
      )}
    </div>
  );
}
