// Consult stage: Mira presence, transcript, composer, glass call dock.
// Mute lives only in the dock (DESIGN §10.3); the grid centres at ≥800.
import { useEffect, useReducer, useRef, useState } from 'react';
import { Button, Card, Chip, Icon, IconButton, MiraPresence, pressProps, Sheet } from '../../lib/ui';
import { elevation, gradients, ink, lines, media, radius, space, surfaces, type } from '../../lib/theme';
import { useBreakpoint } from '../../shell/viewport';
import type { useConsult } from './useConsult';

type Consult = ReturnType<typeof useConsult>;

const CHIPS = ['I have a fever', 'Bad headache', 'Stomach pain'];

function relTime(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 8) return 'just now';
  if (s < 60) return `${s} seconds ago`;
  const m = Math.floor(s / 60);
  return m === 1 ? '1 minute ago' : `${m} minutes ago`;
}

const DRAFT_KEY = 'vd_consult_draft';

export function ConsultView({ consult, onEnd }: { consult: Consult; onEnd: () => void }) {
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const [input, setInput] = useState(() => {
    try {
      return localStorage.getItem(DRAFT_KEY) || '';
    } catch {
      return '';
    }
  });
  const [confirming, setConfirming] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  // Re-render twice a minute so relative timestamps stay fresh.
  const [, tick] = useReducer(x => x + 1, 0);
  useEffect(() => {
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      if (input) localStorage.setItem(DRAFT_KEY, input);
      else localStorage.removeItem(DRAFT_KEY);
    } catch { /* private mode */ }
  }, [input]);

  // Keep the latest turn visible.
  useEffect(() => {
    const el = notesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [consult.messages.length]);

  const send = () => {
    if (!input.trim()) return;
    consult.send(input);
    setInput('');
  };

  const orb = mobile ? 104 : bp === 'tablet' ? 128 : 160;
  const meta = mobile ? type.footnote : type.footnoteT;
  const body = mobile ? type.body : type.bodyT;

  return (
    <div className="vd-scroll vd-consult" style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '16px 20px 26px', overflow: 'hidden' }}>
      <style>{`
        ${media.tabletUp}{
          .vd-consult{display:grid!important;grid-template-columns:minmax(0,720px) 300px!important;justify-content:center;gap:20px;align-items:start;overflow-y:auto!important;padding:20px 28px 28px!important}
          .vd-consult-main{width:100%;min-width:0}
          .vd-consult-side{display:flex!important;flex-direction:column;gap:12px;position:sticky;top:0}
          .vd-consult-notes{max-height:none!important}
        }
        ${media.desktopUp}{
          .vd-consult{grid-template-columns:minmax(0,720px) 340px!important;gap:32px;padding:24px 32px 32px!important}
          .vd-consult-notes{min-height:320px}
        }
      `}</style>
      <div className="vd-consult-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, width: '100%' }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px 10px' }}>
          <IconButton icon="chevL" tone="card" label="Back — end visit options" onClick={() => setConfirming(true)} size={44} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ ...type.subhead, fontWeight: 700, color: ink.primary }}>Dr. Mira · </span>
            <span style={{ ...type.subhead, fontWeight: 600, color: consult.status === 'idle' ? ink.secondary : 'var(--vd-ok-fg)' }}>
              {consult.status === 'idle' ? 'Idle' : 'Live'}
            </span>
          </div>
          <div style={{ width: 44, flex: 'none' }} />
        </div>

        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '4px 0 6px' }}>
          <MiraPresence voiceState={consult.status} size={orb} onTap={consult.orbTap} />
          <div style={{ ...type.micro, letterSpacing: '.1em', color: ink.body }}>Dr. Mira</div>
          <div aria-live="polite" style={{ ...meta, fontWeight: 600, color: ink.secondary, minHeight: 17 }}>
            {consult.status === 'listening' ? 'Listening — speak naturally…'
              : consult.status === 'thinking' ? 'Thinking…'
              : consult.status === 'speaking' ? 'Dr. Mira is speaking — tap orb to interrupt'
              : 'Tap the orb to talk, or type below'}
          </div>
        </div>

        {consult.micDenied && (
          <Card level={1} style={{ marginTop: 10, border: `1px solid var(--vd-warn-bg)` }} pad="12px 14px">
            <div style={{ ...(mobile ? type.callout : type.calloutT), fontWeight: 700, color: ink.primary }}>Microphone is blocked</div>
            <div style={{ ...meta, color: ink.secondary, marginTop: 2 }}>Allow mic access in your browser to talk — or just keep typing below, that works fully.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button variant="secondary" fullWidth onClick={() => { consult.clearMicDenied(); consult.orbTap(); }}>Try again</Button>
              <Button variant="tertiary" fullWidth onClick={() => consult.clearMicDenied()}>Keep typing</Button>
            </div>
          </Card>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%' }}>
          {consult.messages.length > 0 && (
            <Card tone="panel" level={0} pad={0} bordered={false} style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', marginTop: 10, width: '100%', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 8px' }}>
                <div style={{ width: 36, height: 4, borderRadius: radius.pill, background: lines.strong }} />
                <span style={{ ...type.micro, whiteSpace: 'nowrap', color: ink.soft, marginTop: 5 }}>Consultation notes</span>
              </div>
              <div ref={notesRef} className="vd-scroll vd-consult-notes" style={{ flex: 1, overflowY: 'auto', minHeight: 0, maxHeight: '40dvh', padding: `0 ${space[4]}px ${space[3]}px` }}>
                {consult.messages.map((m, i) => {
                  const mine = m.role === 'user';
                  const next = consult.messages[i + 1];
                  const groupEnd = !next || next.role !== m.role;
                  if (!mine) {
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, animation: 'vd-fade var(--vd-dur-3) var(--vd-ease-out) both', padding: '5px 0' }}>
                        <div style={{ flex: 'none', marginTop: 5, width: 10, height: 10, borderRadius: '50%', background: 'var(--vd-orb-mid)', boxShadow: '0 0 8px var(--vd-orb-glow)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...(mobile ? type.callout : type.calloutT), color: ink.body, wordWrap: 'break-word' }}>{m.text}</div>
                          {groupEnd && (
                            <div style={{ marginTop: 2, ...type.caption, color: ink.secondary }}>Dr. Mira · {relTime(m.at)}</div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', animation: 'vd-fade var(--vd-dur-3) var(--vd-ease-out) both', padding: '4px 0' }}>
                      <div
                        style={{
                          maxWidth: '85%', padding: '9px 13px', ...(mobile ? type.callout : type.calloutT), wordWrap: 'break-word',
                          borderRadius: radius.pill, background: surfaces.bubbleMine, color: ink.body,
                          boxShadow: elevation[1],
                        }}
                      >
                        <div>{m.text}</div>
                        {groupEnd && (
                          <div style={{ marginTop: 4, ...type.caption, color: ink.body, opacity: 0.75, textAlign: 'right' }}>
                            You · {relTime(m.at)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {consult.messages.length <= 2 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3], justifyContent: 'flex-start', marginTop: 10 }}>
              {CHIPS.map(c => (
                <Chip key={c} onSelect={() => consult.send(c)}>{c}</Chip>
              ))}
            </div>
          )}

          {consult.failed && (
            <div style={{ marginTop: 10, background: 'var(--vd-bad-bg)', borderRadius: radius.md, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...(mobile ? type.callout : type.calloutT), fontWeight: 700, color: 'var(--vd-bad-fg)' }}>That didn’t go through</div>
                <div style={{ ...meta, color: 'var(--vd-bad-fg)', opacity: 0.85 }}>Check your connection and try again.</div>
              </div>
              <Button variant="secondary" onClick={() => consult.retry()}>Try again</Button>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: surfaces.card, border: `1px solid ${lines.hairline}`, borderRadius: radius.pill, padding: '4px 4px 4px 14px' }}>
              <input
                value={input}
                aria-label="Type your message instead"
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Type instead — e.g. fever 3 days…"
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 16, color: ink.primary, padding: '10px 6px', minWidth: 0 }}
              />
              <div {...pressProps(send, 'Send message')} style={{ cursor: 'pointer', width: 44, height: 44, borderRadius: radius.pill, background: gradients.send, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--vd-shadow-cta)', flex: 'none', color: 'var(--vd-ink-on-brand)' }}>
                <Icon name="send" size={18} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <div className="vd-glass" style={{ display: 'flex', alignItems: 'center', gap: 14, height: 66, padding: '0 18px', borderRadius: radius.pill }}>
              <CtrlBtn
                title={consult.muted ? 'Unmute' : 'Mute'}
                off={consult.muted}
                onClick={() => consult.setMuted(!consult.muted)}
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" stroke="none" />
                  <path d="M5 11v1a7 7 0 0 0 14 0v-1" /><line x1="12" y1="19" x2="12" y2="22" />
                  {consult.muted && <line x1="3" y1="3" x2="21" y2="21" />}
                </svg>
              </CtrlBtn>
              <div
                {...pressProps(() => setConfirming(true), 'End call')}
                title="End call"
                style={{ width: 44, height: 44, borderRadius: radius.pill, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradients.danger, boxShadow: elevation[2], color: 'var(--vd-ink-on-brand)' }}
              >
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'rotate(135deg)' }}>
                  <path d="M6.6 3.4c.5-.1 1 .2 1.2.7l1.1 2.6c.2.5.1 1-.3 1.4L7.3 9.4a12.5 12.5 0 0 0 5.3 5.3l1.3-1.3c.4-.4.9-.5 1.4-.3l2.6 1.1c.5.2.8.7.7 1.2l-.5 2.6c-.1.6-.6 1-1.2 1A15.2 15.2 0 0 1 3 6.7c0-.6.4-1.1 1-1.2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="vd-consult-side" aria-label="Visit information" style={{ display: 'none' }}>
        <Card>
          <div style={{ ...type.micro, color: ink.secondary }}>This visit</div>
          <div style={{ ...(mobile ? type.headline : type.headlineT), color: ink.primary, marginTop: 6 }}>{consult.status === 'idle' ? 'Not started yet' : 'Live with Dr. Mira'}</div>
          <div style={{ ...(mobile ? type.callout : type.calloutT), color: ink.secondary, marginTop: 4 }}>Speak or type — everything lands in your consultation notes.</div>
        </Card>
        <Card>
          <div style={{ ...type.micro, color: ink.secondary }}>Good to know</div>
          <div style={{ ...(mobile ? type.callout : type.calloutT), color: ink.body, marginTop: 6 }}>Your Penicillin allergy is on file and respected. A licensed doctor reviews every plan.</div>
        </Card>
      </aside>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="End this visit?"
        label="End visit"
        footer={(
          <>
            <Button variant="danger" fullWidth onClick={onEnd}>End visit</Button>
            <Button variant="secondary" fullWidth onClick={() => setConfirming(false)}>Keep talking</Button>
          </>
        )}
      >
        <div style={{ ...body, color: ink.secondary }}>Your notes are kept — you can start a fresh consult anytime.</div>
      </Sheet>
    </div>
  );
}

function CtrlBtn({ children, title, off, on, onClick }: {
  children: React.ReactNode; title: string; off: boolean; on?: boolean; onClick: () => void;
}) {
  return (
    <div
      {...pressProps(onClick, title)}
      title={title}
      style={{
        width: 44, height: 44, borderRadius: radius.pill, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: off ? 'var(--vd-bad-bg)' : on ? gradients.primary : surfaces.card,
        color: off ? 'var(--vd-bad-fg)' : on ? 'var(--vd-ink-on-brand)' : ink.onGlass,
        boxShadow: elevation[1],
      }}
    >
      {children}
    </div>
  );
}
