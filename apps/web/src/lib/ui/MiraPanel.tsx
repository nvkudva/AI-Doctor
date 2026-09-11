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
import { useFocusEntry } from './Dismiss';
import { type VoiceState } from './Mira';
import { useRailOffset } from './NavBar';
import { toneStyle, type Tone } from '../theme';
import { useBreakpoint } from '../../shell/viewport';
import s from './MiraPanel.module.css';

export interface Suggestion {
  label: string;
  /** Tints the pill — a decline reads red, a reassurance green. */
  tone?: Tone;
}

export interface MiraTurn {
  role: 'user' | 'mira';
  text: string;
  at: number;
  /** A photo the person attached, as a data URL. Rendered in their own turn. */
  image?: string;
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
  /** Attach a photo to the conversation. Absent means the surface offers none. */
  attach?: (image: string) => void;
  /** Stop speaking and listening, without discarding the conversation. */
  silence?: () => void;
  micDenied?: boolean;
  clearMicDenied?: () => void;
  failed?: boolean;
  retry?: () => void;
}

// Waveform prototype: 29 bars on one keyframe, staggered by delay. Amplitude
// and tempo come from the voice state; the orb itself lives in the nav now.
const BARS = 29;

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
      className={s.wave}
    >
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          className={`${s.bar}${state === 'idle' ? ' ' + s.barIdle : ''}`}
          style={{ height: barHeight(i, state), animationDelay: `${(i % 7) * 0.11}s` }}
        />
      ))}
    </div>
  );
}

// Photos are downscaled before they enter the conversation: a phone camera
// frame is several megabytes, and every turn of it would be carried through the
// transcript, the draft and localStorage.
const MAX_EDGE = 1280;

function readImage(file: File, done: (image: string) => void) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    done(c.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = () => { URL.revokeObjectURL(url); };
  img.src = url;
}

// A dock switch. `off` tints it red, the way a call UI marks a disabled input.
function DockBtn({ off, label, onClick, children }: {
  off: boolean; label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <div
      {...pressProps(onClick, label)}
      title={label}
      className={`${s.dockBtn}${off ? ' ' + s.dockBtnOff : ''}`}
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
  const mobile = useBreakpoint() === 'mobile';
  const railOffset = useRailOffset();
  const [input, setInput] = useState(() => {
    try { return localStorage.getItem(draftKey) || ''; } catch { return ''; }
  });
  // Prototype only — nothing is captured yet.
  const notesRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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

  const frame = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // The panel floats over an app that stays interactive by design (PRD MC-5),
  // so it is a non-modal dialog: focus moves into it on open and back to the
  // orb on close, but Tab is deliberately not trapped (see UX-26 / QA-07).
  useFocusEntry(frame, open);

  if (!open) return null;

  const send = () => {
    if (!input.trim()) return;
    session.send(input);
    setInput('');
  };

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
        className={s.positioner}
        style={{ '--mira-left': mobile ? undefined : `${railOffset + 10}px` } as React.CSSProperties}
      >
      <div ref={frame} tabIndex={-1} role="dialog" aria-label="Dr. Mira" className={s.frame}>
        <Card className={s.surface}>
          <div className={s.title}>
            <span className={s.titleName}>Dr. Mira · </span>
            <span className={`${s.titleState}${session.status === 'idle' ? ' ' + s.titleIdle : ''}`}>
              {session.status === 'idle' ? 'Idle' : 'Live'}
            </span>
          </div>

          <div
            className={s.waveWrap}
            style={{ '--vd-wave-dur': WAVE_TEMPO[session.status] } as React.CSSProperties}
          >
            <Waveform state={session.status} onTap={session.orbTap} />
            {/* Only rendered when there is something to say, so the wave sits
                straight on top of the notes. */}
            {statusLine && (
              <div aria-live="polite" className={s.status}>
                {statusLine}
              </div>
            )}
          </div>

          <div className={s.body}>
            {session.micDenied && (
              <Card level={1} pad="12px 14px" className={s.micCard}>
                <div className={s.micTitle}>Microphone is blocked</div>
                <div className={s.micBody}>Allow mic access to talk — or keep typing, that works fully.</div>
                <div className={s.micActions}>
                  <Button variant="secondary" fullWidth onClick={() => { session.clearMicDenied?.(); session.orbTap(); }}>Try again</Button>
                  <Button variant="tertiary" fullWidth onClick={() => session.clearMicDenied?.()}>Keep typing</Button>
                </div>
              </Card>
            )}

            <Card tone="panel" bordered={false} className={s.notesCard}>
              <div className={s.notesHead}>
                <div className={s.grabber} />
                <span className={s.notesLabel}>Consultation notes</span>
              </div>
              <div ref={notesRef} className={s.notes}>
                {session.messages.length === 0 && (
                  <div className={s.notesEmpty}>
                    Nothing yet — tap the orb or send a message to begin.
                  </div>
                )}
                {session.messages.map((m, i) => {
                  const mine = m.role === 'user';
                  const next = session.messages[i + 1];
                  const groupEnd = !next || next.role !== m.role;
                  return (
                    <div key={i} className={`${s.turn}${mine ? ' ' + s.turnMine : ''}`}>
                      <div className={`${s.bubble}${mine ? ' ' + s.bubbleMine : ''}`}>
                        {m.image && (
                          <img
                            src={m.image}
                            alt={m.text || 'Photo you attached'}
                            className={s.photo}
                          />
                        )}
                        <div className={s.bubbleText}>{m.text}</div>
                        {groupEnd && (
                          <div className={`${s.stamp}${mine ? ' ' + s.stampMine : ''}`}>
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
              <div className={s.failed}>
                <div className={s.failedText}>That didn’t go through</div>
                <Button variant="secondary" onClick={() => session.retry?.()}>Try again</Button>
              </div>
            )}

            {session.suggestions.length > 0 && (
              <div className={s.pills}>
                {session.suggestions.map(sg => (
                  <button
                    key={sg.label}
                    type="button"
                    className={`vd-tag ${s.pill}`}
                    onClick={() => session.send(sg.label)}
                    style={toneStyle(sg.tone ?? 'neutral')}
                  >
                    {sg.label}
                  </button>
                ))}
              </div>
            )}

            <div className={s.composer}>
              {session.attach && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={e => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) readImage(f, session.attach!);
                    }}
                  />
                  <div
                    {...pressProps(() => fileRef.current?.click(), 'Add a photo')}
                    className={s.attach}
                  >
                    <Icon name="camera" size={20} />
                  </div>
                </>
              )}
              <input
                value={input}
                aria-label="Type your message instead"
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={placeholder}
                className={s.input}
              />
              <div {...pressProps(send, 'Send message')} className={s.send}>
                <Icon name="send" size={18} />
              </div>
            </div>

            <div className={s.dockRow}>
              <div className={`vd-glass ${s.dock}`}>
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
                {/* The camera control was removed: nothing was ever captured,
                    and a patient with a rash would tap it and wait (UX-22). */}
                <div
                  {...pressProps(() => { session.silence?.(); onClose(); }, 'Close Dr. Mira')}
                  title="Close Dr. Mira"
                  className={`${s.dockBtn} ${s.dockClose}`}
                >
                  {/* Closes rather than minimizes: audio stops on the way out, so
                      nothing keeps talking behind a hidden panel. The transcript
                      survives, so reopening resumes where it left off. */}
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
