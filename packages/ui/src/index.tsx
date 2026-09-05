// Shared presentational components. Props in, elements out — no data
// fetching, no browser APIs, no voice. Imports theme and core only.

import { useState } from 'react';
import { font, ink, pillStyle, radius } from '@vd/theme';

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

export function StatusPill({ status }: { status: string }) {
  return <span style={pillStyle(status) as React.CSSProperties}>{labelOf(status)}</span>;
}

function labelOf(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending', pending_review: 'Pending review', approved: 'Approved',
    changes: 'Changes', rejected: 'Declined', expired: 'Expired',
    high: 'High', medium: 'Medium', low: 'Low',
  };
  return map[status] || status;
}

export function MicroLabel({ children, accent: acc = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ fontSize: font.micro, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: acc ? 'var(--vd-brand-1)' : ink.muted }}>
      {children}
    </div>
  );
}

// Single SF-symbols-style stroke icon set. One weight (1.5), currentColor —
// no emoji, no ad-hoc glyphs in app code.
const ICON_PATHS: Record<string, React.ReactNode> = {
  mic: <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11v1a7 7 0 0 0 14 0v-1" /><path d="M12 19v3" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  doc: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M10 12h5M10 16h5" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevL: <path d="M14.5 5L8 12l6.5 7" />,
  chevD: <path d="M5 9.5L12 16l7-6.5" />,
  phone: <path d="M6.6 3.4c.5-.1 1 .2 1.2.7l1.1 2.6c.2.5.1 1-.3 1.4L7.3 9.4a12.5 12.5 0 0 0 5.3 5.3l1.3-1.3c.4-.4.9-.5 1.4-.3l2.6 1.1c.5.2.8.7.7 1.2l-.5 2.6c-.1.6-.6 1-1.2 1A15.2 15.2 0 0 1 3 6.7c0-.6.4-1.1 1-1.2z" />,
  person: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  clock: <><path d="M3.5 11.5a8.5 8.5 0 1 1 2.6 6.1" /><path d="M3.5 20v-4.6h4.6" /><path d="M12 7.6V12l3 1.9" /></>,
  drop: <><path d="M12 2.5c3.4 3.9 5.6 6.9 5.6 9.9a5.6 5.6 0 0 1-11.2 0c0-3 2.2-6 5.6-9.9z" /><path d="M12 10v4M10 12h4" /></>,
  home: <path d="M3 9.6 12 3l9 6.6V20a1 1 0 0 1-1 1h-5v-6.2H9V21H4a1 1 0 0 1-1-1z" />,
  speaker: <><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></>,
  send: <path d="M4 12h13M12 5l7 7-7 7" />,
};

export function Icon({ name, size = 20 }: { name: keyof typeof ICON_PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

// Expandable section with button semantics + arrow affordance. Shared by
// the doctor case detail ("What the patient said") and patient cards.
export function Disclosure({ title, defaultOpen, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(o => !o);
          }
        }}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: ink.secondary, padding: '6px 0', minHeight: 44 }}
      >
        <span style={{ display: 'inline-block', transition: 'transform .2s var(--vd-spring)', transform: open ? 'rotate(90deg)' : 'none', fontSize: 10 }}>▶</span>
        {title}
      </div>
      {open && <div style={{ animation: 'vd-fade .25s ease both' }}>{children}</div>}
    </div>
  );
}

// Accessibility helper for div-based tap targets: adds button semantics,
// keyboard activation, and an accessible name in one spread.
export function pressProps(action: () => void, label: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: action,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action();
      }
    },
  };
}


