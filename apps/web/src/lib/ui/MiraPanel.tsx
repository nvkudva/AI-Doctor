// The one Dr. Mira surface (PRD MC-1). Both modules render this: orb,
// transcript, context pills, composer, call dock. Only the session behind it
// differs — who Mira is talking to, and what the pills offer.
//
// It is always a phone-shaped card, and it is not modal: no scrim, and the rest
// of the app stays live behind it. It docks to the nav — sitting on the bottom
// bar below 800, and against the rail's edge above it — so it reads as part of
// the same component.
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Icon, pressProps } from './Primitives';
import { type VoiceState } from './Mira';
import { useRailOffset } from './NavBar';
import { elevation, gradients, ink, lines, radius, space, surfaces, toneStyle, type, z, type Tone } from '../theme';
import { useBreakpoint } from '../../shell/viewport';

export interface Suggestion {
  label: string;
  /** Tints the pill — a decline reads red, a reassurance green. */
  tone?: Tone;
}

export interface MiraTurn {
  role: 'user' | 'mira';
  text: string;
  at: number;
}

/** What the panel needs from a session. useConsult and useReview both satisfy it. */
export interface MiraSession {
  messages: MiraTurn[];
  status: VoiceState;
  /** Mira's voice. Off means she replies in text only. */
  speakerOff: boolean;
  setSpeakerOff: (v: boolean) => void;
  /** Whether she is listening. Off means you type instead. */
  micOff: boolean;
  setMicOff: (v: boolean) => void;
  /** Tap the orb: interrupt, listen, or open the conversation. */
  orbTap: () => void;
  send: (text: string) => void;
  /** Context pills above the composer — they differ per role. */
  suggestions: Suggestion[];
  micDenied?: boolean;
  clearMicDenied?: () => void;
  failed?: boolean;
  retry?: () => void;
}

const PHONE_W = 393;
const PHONE_H = 852;

// Waveform prototype: 29 bars on one keyframe, staggered by delay. Amplitude
// and tempo come from the voice state; the orb itself lives in the nav now.
const BARS = 29;
const waveCss = `
@keyframes vd-wave{0%,100%{transform:scaleY(.18)}50%{transform:scaleY(1)}}
.vd-wave-bar{transform-origin:center;animation:vd-wave var(--vd-wave-dur) var(--vd-ease-spring) infinite both}
@media (prefers-reduced-motion: reduce){.vd-wave-bar{animation:none;transform:scaleY(.4)}}`;

const WAVE_TEMPO: Record<VoiceState, string> = {
  idle: '2.6s',
  listening: '0.9s',
  thinking: '1.8s',
  speaking: '0.7s',
};

// Peak height per bar, tallest in the middle. Flattened when idle.
function barHeight(i: number, state: VoiceState): number {
  const mid = (BARS - 1) / 2;
  const falloff = 1 - Math.abs(i - mid) / (mid + 2);
  const jitter = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7));
  const peak = state === 'idle' ? 0.22 : state === 'thinking' ? 0.5 : 1;
  return Math.max(4, Math.round(56 * falloff * jitter * peak));
}

function Waveform({ state, onTap }: { state: VoiceState; onTap: () => void }) {
  return (
    <div
      {...pressProps(onTap, state === 'speaking' ? 'Interrupt Dr. Mira' : 'Talk to Dr. Mira')}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
        height: 64, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}
    >
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          className="vd-wave-bar"
          style={{
            width: 4, height: barHeight(i, state), borderRadius: radius.pill,
            background: state === 'idle' ? 'var(--vd-border-strong)' : gradients.call,
            animationDelay: `${(i % 7) * 0.11}s`,
          }}
        />
      ))}
    </div>
  );
}

// One skin for a chat bubble; the suggestion pills reuse the incoming one so a
// pill reads as a reply you could have made.
function bubbleStyle(mine: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: radius.lg,
    ...type.footnote,
    background: mine ? surfaces.bubbleMine : surfaces.card,
    color: ink.body,
    border: mine ? 'none' : `1px solid ${lines.hairline}`,
    boxShadow: elevation[1],
    textAlign: 'left',
  };
}

// A dock switch. `off` tints it red, the way a call UI marks a disabled input.
function DockBtn({ off, label, onClick, children }: {
  off: boolean; label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <div
      {...pressProps(onClick, label)}
      title={label}
      style={{
        width: 44, height: 44, borderRadius: radius.pill, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: elevation[1],
        background: off ? 'var(--vd-bad-bg)' : surfaces.card,
        color: off ? 'var(--vd-bad-fg)' : ink.onGlass,
      }}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}

function relTime(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 8) return 'just now';
  if (s < 60) return `${s} seconds ago`;
  const m = Math.floor(s / 60);
  return m === 1 ? '1 minute ago' : `${m} minutes ago`;
}

export function MiraPanel({
  open, onClose, session, youLabel, placeholder, draftKey,
}: {
  open: boolean;
  /** Hides the panel. The session keeps running and the transcript is kept, so
   *  reopening resumes exactly where it left off. */
  onClose: () => void;
  session: MiraSession;
  /** How the human's own turns are attributed. */
  youLabel: string;
  placeholder: string;
  /** localStorage key for the unsent draft. */
  draftKey: string;
}) {
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const railOffset = useRailOffset();
  const [input, setInput] = useState(() => {
    try { return localStorage.getItem(draftKey) || ''; } catch { return ''; }
  });
  // Prototype only — nothing is captured yet.
  const [camera, setCamera] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  const [, tick] = useState(0);

  // Relative timestamps stay fresh while the panel is open.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => tick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    try {
      if (input) localStorage.setItem(draftKey, input);
      else localStorage.removeItem(draftKey);
    } catch { /* private mode */ }
  }, [input, draftKey]);

  useEffect(() => {
    const el = notesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.messages.length, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const send = () => {
    if (!input.trim()) return;
    session.send(input);
    setInput('');
  };

  // Matches the bar's own gutters below 800, and the rail's above it.
  const gutter = mobile ? 14 : bp === 'tablet' ? 16 : 20;
  const dockGap = 10;
  const statusLine =
    session.status === 'listening' ? 'Listening — speak naturally…'
      : session.status === 'thinking' ? 'Thinking…'
        : session.status === 'speaking' ? 'Dr. Mira is speaking — tap the wave to interrupt'
          // Idle needs no prompt; the waveform and composer speak for themselves.
          : '';

  return (
    <>
      {/* Positioner only: it lets every pointer event through, so the app behind
          stays usable. The card carries the pop animation, which owns
          `transform`. */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: z.nav + 1, pointerEvents: 'none',
          display: 'flex',
          alignItems: mobile ? 'flex-end' : 'flex-start',
          justifyContent: mobile ? 'center' : 'flex-start',
          paddingTop: gutter,
          paddingRight: gutter,
          paddingLeft: mobile ? gutter : railOffset + dockGap,
          // Clears the bar and the orb that overhangs its top edge.
          paddingBottom: mobile ? `calc(${62 + 30 + 16 + dockGap}px + env(safe-area-inset-bottom))` : gutter,
        }}
      >
      <div
        role="dialog"
        aria-label="Dr. Mira"
        style={{
          pointerEvents: 'auto',
          width: mobile ? `min(372px, 100%)` : `min(${PHONE_W}px, 100%)`,
          aspectRatio: `${PHONE_W} / ${PHONE_H}`,
          maxHeight: '100%',
          display: 'flex',
          animation: 'vd-pop var(--vd-dur-4) var(--vd-ease-overshoot) both',
        }}
      >
        <Card
          level={5}
          pad={0}
          style={{
            flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', borderRadius: radius['2xl'],
          }}
        >
          <style>{waveCss}</style>
          <div style={{ flex: 'none', textAlign: 'center', padding: `${space[4]}px ${space[4]}px 0` }}>
            <span style={{ ...type.subhead, fontWeight: 700, color: ink.primary }}>Dr. Mira · </span>
            <span style={{ ...type.subhead, fontWeight: 600, color: session.status === 'idle' ? ink.secondary : 'var(--vd-ok-fg)' }}>
              {session.status === 'idle' ? 'Idle' : 'Live'}
            </span>
          </div>

          <div
            style={{ flex: 'none', padding: `0 ${space[4]}px`, ['--vd-wave-dur' as string]: WAVE_TEMPO[session.status] }}
          >
            <Waveform state={session.status} onTap={session.orbTap} />
            {/* Only rendered when there is something to say, so the wave sits
                straight on top of the notes. */}
            {statusLine && (
              <div aria-live="polite" style={{ ...type.footnote, fontWeight: 600, color: ink.secondary, textAlign: 'center', paddingBottom: space[2] }}>
                {statusLine}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: `0 ${space[4]}px ${space[4]}px` }}>
            {session.micDenied && (
              <Card level={1} pad="12px 14px" style={{ marginBottom: space[3], border: '1px solid var(--vd-warn-bg)' }}>
                <div style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>Microphone is blocked</div>
                <div style={{ ...type.footnote, color: ink.secondary, marginTop: 2 }}>Allow mic access to talk — or keep typing, that works fully.</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <Button variant="secondary" fullWidth onClick={() => { session.clearMicDenied?.(); session.orbTap(); }}>Try again</Button>
                  <Button variant="tertiary" fullWidth onClick={() => session.clearMicDenied?.()}>Keep typing</Button>
                </div>
              </Card>
            )}

            <Card tone="panel" level={0} pad={0} bordered={false} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
                <div style={{ width: 36, height: 4, borderRadius: radius.pill, background: lines.strong }} />
                <span style={{ ...type.micro, whiteSpace: 'nowrap', color: ink.soft, marginTop: 5 }}>Consultation notes</span>
              </div>
              <div ref={notesRef} className="vd-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: `0 ${space[4]}px ${space[3]}px` }}>
                {session.messages.length === 0 && (
                  <div style={{ ...type.footnote, color: ink.secondary, textAlign: 'center', padding: `${space[4]}px 0` }}>
                    Nothing yet — tap the orb or send a message to begin.
                  </div>
                )}
                {session.messages.map((m, i) => {
                  const mine = m.role === 'user';
                  const next = session.messages[i + 1];
                  const groupEnd = !next || next.role !== m.role;
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start',
                        padding: '3px 0', animation: 'vd-fade var(--vd-dur-3) var(--vd-ease-out) both',
                      }}
                    >
                      <div style={{ ...bubbleStyle(mine), maxWidth: '86%', minWidth: 0 }}>
                        <div style={{ wordWrap: 'break-word' }}>{m.text}</div>
                        {groupEnd && (
                          <div style={{
                            marginTop: 3, ...type.micro, letterSpacing: 0, textTransform: 'none',
                            color: mine ? ink.body : ink.secondary, opacity: mine ? 0.75 : 1,
                            textAlign: mine ? 'right' : 'left',
                          }}>
                            {mine ? youLabel : 'Dr. Mira'} · {relTime(m.at)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {session.failed && (
              <div style={{ marginTop: space[3], background: 'var(--vd-bad-bg)', borderRadius: radius.md, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, ...type.footnote, fontWeight: 700, color: 'var(--vd-bad-fg)' }}>That didn’t go through</div>
                <Button variant="secondary" onClick={() => session.retry?.()}>Try again</Button>
              </div>
            )}

            {session.suggestions.length > 0 && (
              <div style={{ flex: 'none', display: 'flex', gap: space[2], marginTop: space[3], overflowX: 'auto', paddingBottom: 2 }} className="vd-scroll">
                {session.suggestions.map(sg => (
                  <button
                    key={sg.label}
                    type="button"
                    onClick={() => session.send(sg.label)}
                    style={{
                      ...type.caption, fontWeight: 700, flex: 'none', cursor: 'pointer',
                      whiteSpace: 'nowrap', padding: '5px 11px', borderRadius: radius.pill,
                      ...toneStyle(sg.tone ?? 'neutral'),
                    }}
                  >
                    {sg.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, marginTop: space[3], background: surfaces.card, border: `1px solid ${lines.hairline}`, borderRadius: radius.pill, padding: '4px 4px 4px 14px' }}>
              <input
                value={input}
                aria-label="Type your message instead"
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={placeholder}
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 16, color: ink.primary, padding: '10px 6px', minWidth: 0 }}
              />
              <div {...pressProps(send, 'Send message')} style={{ cursor: 'pointer', width: 44, height: 44, borderRadius: radius.pill, background: gradients.send, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--vd-shadow-cta)', flex: 'none', color: 'var(--vd-ink-on-brand)' }}>
                <Icon name="send" size={18} />
              </div>
            </div>

            <div style={{ flex: 'none', display: 'flex', justifyContent: 'center', marginTop: space[3] }}>
              <div className="vd-glass" style={{ display: 'flex', alignItems: 'center', gap: 10, height: 62, padding: '0 14px', borderRadius: radius.pill }}>
                <DockBtn
                  off={session.speakerOff}
                  label={session.speakerOff ? 'Let Dr. Mira speak' : 'Silence Dr. Mira'}
                  onClick={() => session.setSpeakerOff(!session.speakerOff)}
                >
                  <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
                  {session.speakerOff
                    ? <line x1="16" y1="9" x2="21" y2="15" />
                    : <path d="M16.5 8.5a5 5 0 0 1 0 7" />}
                  {session.speakerOff && <line x1="21" y1="9" x2="16" y2="15" />}
                </DockBtn>
                <DockBtn
                  off={session.micOff}
                  label={session.micOff ? 'Turn microphone on' : 'Turn microphone off'}
                  onClick={() => session.setMicOff(!session.micOff)}
                >
                  <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" stroke="none" />
                  <path d="M5 11v1a7 7 0 0 0 14 0v-1" /><line x1="12" y1="19" x2="12" y2="22" />
                  {session.micOff && <line x1="3" y1="3" x2="21" y2="21" />}
                </DockBtn>
                <DockBtn
                  off={!camera}
                  label={camera ? 'Turn camera off' : 'Turn camera on'}
                  onClick={() => setCamera(c => !c)}
                >
                  <rect x="2.5" y="6.5" width="13" height="11" rx="2.5" />
                  <path d="M15.5 10.5l6-3v9l-6-3z" />
                  {!camera && <line x1="3" y1="3" x2="21" y2="21" />}
                </DockBtn>
                <div
                  {...pressProps(onClose, 'Hide Dr. Mira')}
                  style={{ width: 44, height: 44, borderRadius: radius.pill, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradients.danger, boxShadow: elevation[2], color: 'var(--vd-ink-on-brand)' }}
                >
                  <Icon name="x" size={20} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
      </div>

    </>
  );
}
