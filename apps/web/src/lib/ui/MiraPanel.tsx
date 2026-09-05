// The one Dr. Mira surface (PRD MC-1). Both modules render this: orb,
// transcript, context pills, composer, call dock. Only the session behind it
// differs — who Mira is talking to, and what the pills offer.
//
// It is always a phone-shaped card, and it is not modal: no scrim, and the rest
// of the app stays live behind it. It docks to the nav — sitting on the bottom
// bar below 800, and against the rail's edge above it — so it reads as part of
// the same component.
import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { Icon, pressProps } from './Primitives';
import { MiraPresence, type VoiceState } from './Mira';
import { Sheet } from './Sheet';
import { useRailOffset } from './NavBar';
import { elevation, gradients, ink, lines, radius, space, surfaces, type, z } from '../theme';
import { useBreakpoint } from '../../shell/viewport';

export interface MiraTurn {
  role: 'user' | 'mira';
  text: string;
  at: number;
}

/** What the panel needs from a session. useConsult and useReview both satisfy it. */
export interface MiraSession {
  messages: MiraTurn[];
  status: VoiceState;
  muted: boolean;
  setMuted: (m: boolean) => void;
  /** Tap the orb: interrupt, listen, or open the conversation. */
  orbTap: () => void;
  send: (text: string) => void;
  /** Context pills above the composer — they differ per role. */
  suggestions: string[];
  micDenied?: boolean;
  clearMicDenied?: () => void;
  failed?: boolean;
  retry?: () => void;
}

const PHONE_W = 393;
const PHONE_H = 852;

function relTime(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 8) return 'just now';
  if (s < 60) return `${s} seconds ago`;
  const m = Math.floor(s / 60);
  return m === 1 ? '1 minute ago' : `${m} minutes ago`;
}

export function MiraPanel({
  open, onClose, session, youLabel, placeholder, draftKey, endTitle, endBody, endConfirm, onEnd,
}: {
  open: boolean;
  /** Dismiss without ending — scrim tap, Escape, close button. */
  onClose: () => void;
  session: MiraSession;
  /** How the human's own turns are attributed. */
  youLabel: string;
  placeholder: string;
  /** localStorage key for the unsent draft. */
  draftKey: string;
  endTitle: string;
  endBody: string;
  endConfirm: string;
  /** Red dock button: ends the session and closes the panel. */
  onEnd: () => void;
}) {
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const railOffset = useRailOffset();
  const [input, setInput] = useState(() => {
    try { return localStorage.getItem(draftKey) || ''; } catch { return ''; }
  });
  const [confirming, setConfirming] = useState(false);
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
        : session.status === 'speaking' ? 'Dr. Mira is speaking — tap orb to interrupt'
          : 'Tap the orb to talk, or type below';

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
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: `${space[3]}px ${space[3]}px 0` }}>
            <div style={{ flex: 1, textAlign: 'center', paddingLeft: 44 }}>
              <span style={{ ...type.subhead, fontWeight: 700, color: ink.primary }}>Dr. Mira · </span>
              <span style={{ ...type.subhead, fontWeight: 600, color: session.status === 'idle' ? ink.secondary : 'var(--vd-ok-fg)' }}>
                {session.status === 'idle' ? 'Idle' : 'Live'}
              </span>
            </div>
            <IconButton icon="x" tone="plain" label="Close Dr. Mira" onClick={onClose} size={44} />
          </div>

          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: `${space[2]}px 0` }}>
            <MiraPresence voiceState={session.status} size={104} onTap={session.orbTap} />
            <div aria-live="polite" style={{ ...type.footnote, fontWeight: 600, color: ink.secondary, minHeight: 17, textAlign: 'center', padding: `0 ${space[4]}px` }}>
              {statusLine}
            </div>
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
                  if (!mine) {
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, animation: 'vd-fade var(--vd-dur-3) var(--vd-ease-out) both', padding: '5px 0' }}>
                        <div style={{ flex: 'none', marginTop: 5, width: 10, height: 10, borderRadius: '50%', background: 'var(--vd-orb-mid)', boxShadow: '0 0 8px var(--vd-orb-glow)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...type.callout, color: ink.body, wordWrap: 'break-word' }}>{m.text}</div>
                          {groupEnd && <div style={{ marginTop: 2, ...type.caption, color: ink.secondary }}>Dr. Mira · {relTime(m.at)}</div>}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', animation: 'vd-fade var(--vd-dur-3) var(--vd-ease-out) both', padding: '4px 0' }}>
                      <div style={{
                        maxWidth: '85%', padding: '9px 13px', ...type.callout, wordWrap: 'break-word',
                        borderRadius: radius.pill, background: surfaces.bubbleMine, color: ink.body, boxShadow: elevation[1],
                      }}>
                        <div>{m.text}</div>
                        {groupEnd && (
                          <div style={{ marginTop: 4, ...type.caption, color: ink.body, opacity: 0.75, textAlign: 'right' }}>
                            {youLabel} · {relTime(m.at)}
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
                  <Chip key={sg} onSelect={() => session.send(sg)} style={{ flex: 'none' }}>{sg}</Chip>
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
              <div className="vd-glass" style={{ display: 'flex', alignItems: 'center', gap: 14, height: 62, padding: '0 18px', borderRadius: radius.pill }}>
                <div
                  {...pressProps(() => session.setMuted(!session.muted), session.muted ? 'Unmute' : 'Mute')}
                  style={{
                    width: 44, height: 44, borderRadius: radius.pill, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: elevation[1],
                    background: session.muted ? 'var(--vd-bad-bg)' : surfaces.card,
                    color: session.muted ? 'var(--vd-bad-fg)' : ink.onGlass,
                  }}
                >
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" stroke="none" />
                    <path d="M5 11v1a7 7 0 0 0 14 0v-1" /><line x1="12" y1="19" x2="12" y2="22" />
                    {session.muted && <line x1="3" y1="3" x2="21" y2="21" />}
                  </svg>
                </div>
                <div
                  {...pressProps(() => setConfirming(true), 'End call')}
                  style={{ width: 44, height: 44, borderRadius: radius.pill, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradients.danger, boxShadow: elevation[2], color: 'var(--vd-ink-on-brand)' }}
                >
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'rotate(135deg)' }}>
                    <path d="M6.6 3.4c.5-.1 1 .2 1.2.7l1.1 2.6c.2.5.1 1-.3 1.4L7.3 9.4a12.5 12.5 0 0 0 5.3 5.3l1.3-1.3c.4-.4.9-.5 1.4-.3l2.6 1.1c.5.2.8.7.7 1.2l-.5 2.6c-.1.6-.6 1-1.2 1A15.2 15.2 0 0 1 3 6.7c0-.6.4-1.1 1-1.2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
      </div>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={endTitle}
        label={endTitle}
        footer={(
          <>
            <Button variant="danger" fullWidth onClick={() => { setConfirming(false); onEnd(); }}>{endConfirm}</Button>
            <Button variant="secondary" fullWidth onClick={() => setConfirming(false)}>Keep talking</Button>
          </>
        )}
      >
        <div style={{ ...type.body, color: ink.secondary }}>{endBody}</div>
      </Sheet>
    </>
  );
}
