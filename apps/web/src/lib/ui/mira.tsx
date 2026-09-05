// Mira visuals: state-animated presence sphere. Props in, elements out.

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATE_RING: Record<VoiceState, string> = {
  idle: 'rgba(120,95,225,.45)',
  listening: 'var(--vd-state-listen)',
  thinking: 'var(--vd-state-think)',
  speaking: 'var(--vd-state-speak)',
};

// Whole-sphere motion per state. Thinking moves the fluid layer only (see
// MiraOrb), so the core stays still while the mind swirls.
const SPHERE_ANIM: Record<VoiceState, string | undefined> = {
  idle: 'vd-breathe 4s ease-in-out infinite',
  listening: 'vd-listen 1.2s ease-in-out infinite',
  thinking: undefined,
  speaking: 'vd-speak 0.9s ease-in-out infinite',
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
          animation: voiceState === 'thinking' ? 'vd-swirl 6s linear infinite' : 'vd-spin 12s linear infinite',
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
  voiceState = 'idle', size = 138, onTap,
}: {
  voiceState?: VoiceState;
  size?: number;
  onTap?: () => void;
}) {
  const h = Math.round(size * 1.07);
  const ring = STATE_RING[voiceState];
  const ringAnim = voiceState === 'listening' ? 'vd-ring 1.4s ease-out infinite' : 'vd-ring 2.8s ease-out infinite';
  return (
    <div style={{ position: 'relative', width: size, height: h, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', flex: 'none' }}>
      <div
        style={{
          position: 'absolute', left: '50%', bottom: -2, transform: 'translateX(-50%)',
          width: size * 0.84, height: Math.max(12, size * 0.14), borderRadius: '50%',
          background: 'radial-gradient(ellipse,rgba(90,70,170,.4),transparent 70%)', filter: 'blur(4px)',
        }}
      />
      <div style={{ position: 'absolute', inset: `0 0 ${h - size}px 0`, borderRadius: '50%', border: `1.5px solid ${ring}`, animation: ringAnim }} />
      {voiceState !== 'idle' && (
        <div style={{ position: 'absolute', inset: `0 0 ${h - size}px 0`, borderRadius: '50%', border: `1px solid ${ring}`, opacity: 0.6, animation: `${ringAnim.split(' ')[0]} 2.8s ease-out 1.4s infinite` }} />
      )}
      <div onClick={onTap} style={{ cursor: onTap ? 'pointer' : 'default', borderRadius: '50%' }}>
        <MiraOrb size={size} voiceState={voiceState} />
      </div>
    </div>
  );
}
