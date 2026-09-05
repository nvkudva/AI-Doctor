import { useEffect, useReducer, useRef, useState } from 'react';
import { Icon, MiraPresence, pressProps } from '../../lib/ui';
import { gradients, ink, media, surfaces, z } from '../../lib/theme';
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

  // Escape backs out of the end-visit sheet.
  useEffect(() => {
    if (!confirming) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirming(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [confirming]);

  const send = () => {
    if (!input.trim()) return;
    consult.send(input);
    setInput('');
  };

  return (
    <div className="vd-consult" style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', padding: '16px 20px 26px', overflow: 'hidden' }}>
      <style>{`${media.tabletUp}{.vd-consult{display:grid!important;grid-template-columns:minmax(0,1fr) 300px!important;gap:18px;align-items:start;overflow-y:auto!important}.vd-consult-main{max-width:760px;width:100%;margin:0 auto;min-width:0}.vd-consult-side{display:flex!important;flex-direction:column;gap:12px;position:sticky;top:0}}`}</style>
      <div className="vd-consult-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, width: '100%' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px 10px' }}>
        <div {...pressProps(() => setConfirming(true), 'Back — end visit options')} style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: 99, background: surfaces.chip, color: ink.onGlass, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon name="chevL" size={18} />
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: ink.primary }}>Dr. Mira · </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: consult.status === 'idle' ? ink.muted : 'var(--vd-ok-fg)' }}>
            {consult.status === 'idle' ? 'Idle' : 'Live'}
          </span>
        </div>
        <div
          {...pressProps(() => consult.setMuted(!consult.muted), consult.muted ? 'Unmute' : 'Mute')}
          title={consult.muted ? 'Unmute' : 'Mute'}
          style={{ cursor: 'pointer', width: 38, height: 38, borderRadius: 99, background: consult.muted ? 'var(--vd-bad-bg)' : surfaces.chip, color: consult.muted ? 'var(--vd-bad-fg)' : ink.onGlass, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
        >
          <Icon name="mic" size={18} />
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '4px 0 6px' }}>
        <MiraPresence voiceState={consult.status} size={104} onTap={consult.orbTap} />
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--vd-ink-2)' }}>Dr. Mira</div>
        <div aria-live="polite" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--vd-ink-3)', minHeight: 17 }}>
          {consult.status === 'listening' ? 'Listening — speak naturally…'
            : consult.status === 'thinking' ? 'Thinking…'
            : consult.status === 'speaking' ? 'Dr. Mira is speaking — tap orb to interrupt'
            : 'Tap the orb to talk, or type below'}
        </div>
      </div>

      {consult.micDenied && (
        <div style={{ marginTop: 10, background: 'var(--vd-surface-card)', border: '1px solid var(--vd-warn-bg)', borderRadius: 16, padding: '12px 14px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--vd-ink-1)' }}>Microphone is blocked</div>
          <div style={{ fontSize: 12.5, color: 'var(--vd-ink-3)', marginTop: 2 }}>Allow mic access in your browser to talk — or just keep typing below, that works fully.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <div {...pressProps(() => { consult.clearMicDenied(); consult.orbTap(); }, 'Try microphone again')} style={{ cursor: 'pointer', flex: 1, textAlign: 'center', borderRadius: 99, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vd-surface-chip)', fontSize: 13, fontWeight: 700, color: 'var(--vd-ink-2)' }}>
              Try again
            </div>
            <div {...pressProps(() => consult.clearMicDenied(), 'Keep typing instead')} style={{ cursor: 'pointer', flex: 1, textAlign: 'center', borderRadius: 99, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(30,50,90,.15)', fontSize: 13, fontWeight: 700, color: 'var(--vd-ink-2)' }}>
              Keep typing
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%' }}>
        {consult.messages.length > 0 && (
          <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', background: 'color-mix(in srgb, var(--vd-surface-panel) 92%, transparent)', borderRadius: 16, padding: '6px 14px 10px', marginTop: 10, width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0 8px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 14, background: 'rgba(90,70,180,.28)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: ink.soft, marginTop: 5 }}>Consultation notes</span>
            </div>
            <div ref={notesRef} className="vd-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, maxHeight: '40dvh' }}>
              {consult.messages.map((m, i) => {
                const mine = m.role === 'user';
                const next = consult.messages[i + 1];
                const groupEnd = !next || next.role !== m.role;
                if (!mine) {
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, animation: 'vd-fade .3s ease both', padding: '5px 0' }}>
                      <div style={{ flex: 'none', marginTop: 5, width: 10, height: 10, borderRadius: '50%', background: 'var(--vd-orb-mid)', boxShadow: '0 0 8px var(--vd-orb-glow)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: ink.body, wordWrap: 'break-word' }}>{m.text}</div>
                        {groupEnd && (
                          <div style={{ marginTop: 2, fontSize: 10, fontWeight: 600, color: ink.muted }}>Dr. Mira · {relTime(m.at)}</div>
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', animation: 'vd-fade .3s ease both', padding: '4px 0' }}>
                    <div
                      style={{
                        maxWidth: '85%', padding: '9px 13px', fontSize: 13, lineHeight: 1.55, wordWrap: 'break-word',
                        borderRadius: 99, background: surfaces.bubbleMine, color: ink.body,
                        boxShadow: '0 2px 8px oklch(0.6 0.1 290 / .2)',
                      }}
                    >
                      <div>{m.text}</div>
                      {groupEnd && (
                        <div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, opacity: 0.75, color: ink.muted, textAlign: 'right' }}>
                          You · {relTime(m.at)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {consult.messages.length <= 2 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start', marginTop: 10 }}>
          {CHIPS.map(c => (
            <div
              key={c}
              {...pressProps(() => consult.send(c), c)}
              style={{
                cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap', padding: '12px 14px',
                border: '1px solid oklch(0.85 0.04 300)', borderRadius: 99,
                fontSize: 12, fontWeight: 400, color: ink.body,
                boxShadow: '0 2px 8px oklch(0.6 0.1 290 / .16)', backgroundColor: surfaces.bubbleMine,
              }}
            >
              {c}
            </div>
          ))}
        </div>
        )}

        {consult.failed && (
          <div style={{ marginTop: 10, background: 'var(--vd-bad-bg)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--vd-bad-fg)' }}>That didn’t go through</div>
              <div style={{ fontSize: 12.5, color: 'var(--vd-bad-fg)', opacity: 0.85 }}>Check your connection and try again.</div>
            </div>
            <div {...pressProps(() => consult.retry(), 'Try again')} style={{ cursor: 'pointer', borderRadius: 99, height: 48, padding: '0 20px', display: 'flex', alignItems: 'center', background: 'var(--vd-surface-card)', fontSize: 13, fontWeight: 700, color: 'var(--vd-ink-1)', flex: 'none' }}>
              Try again
            </div>
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'color-mix(in srgb, var(--vd-surface-card) 92%, transparent)', borderRadius: 999, padding: '4px 4px 4px 14px' }}>
            <input
              value={input}
              aria-label="Type your message instead"
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type instead — e.g. fever 3 days…"
              style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 16, color: ink.primary, padding: '10px 6px', minWidth: 0 }}
            />
            <div {...pressProps(send, 'Send message')} style={{ cursor: 'pointer', width: 44, height: 44, borderRadius: '50%', background: gradients.send, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px oklch(0.45 0.2 290 / .5)', flex: 'none', color: '#fff' }}>
              <Icon name="send" size={18} />
            </div>
          </div>
        </div>
      </div>

      {confirming && (
        <div role="dialog" aria-modal="true" aria-label="End visit" style={{ position: 'absolute', left: 12, right: 12, bottom: 104, zIndex: z.sheet, background: surfaces.card, border: '1px solid var(--vd-border)', borderRadius: 20, padding: '12px 16px 16px', boxShadow: '0 20px 50px rgba(12,20,60,.35)', animation: 'vd-slidein .25s var(--vd-spring) both' }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--vd-border)', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: ink.primary, textAlign: 'center' }}>End this visit?</div>
          <div style={{ fontSize: 12.5, color: ink.secondary, marginTop: 2, textAlign: 'center' }}>Your notes are kept — you can start a fresh consult anytime.</div>
          <div {...pressProps(onEnd, 'End visit')} style={{ cursor: 'pointer', marginTop: 12, textAlign: 'center', borderRadius: 99, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradients.danger, fontSize: 15, fontWeight: 700, color: 'var(--vd-ink-on-brand)', fontFamily: 'inherit' }}>
            End visit
          </div>
          <div {...pressProps(() => setConfirming(false), 'Keep talking')} style={{ cursor: 'pointer', marginTop: 8, textAlign: 'center', borderRadius: 99, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: surfaces.chip, fontSize: 15, fontWeight: 700, color: ink.body, fontFamily: 'inherit' }}>
            Keep talking
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 14, height: 66, padding: '0 18px', borderRadius: 34,
            background: gradients.glassBar, backdropFilter: 'var(--vd-glass-blur)', WebkitBackdropFilter: 'var(--vd-glass-blur)',
            border: '1px solid var(--vd-glass-border)',
            boxShadow: '0 14px 34px oklch(0.45 0.12 295 / .3), 0 2px 8px rgba(46,37,71,.14), var(--vd-glass-hi)',
          }}
        >
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
            style={{ width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradients.danger, boxShadow: '0 4px 12px rgba(180,30,60,.5)', color: 'var(--vd-ink-on-brand)' }}
          >
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'rotate(135deg)' }}>
              <path d="M6.6 3.4c.5-.1 1 .2 1.2.7l1.1 2.6c.2.5.1 1-.3 1.4L7.3 9.4a12.5 12.5 0 0 0 5.3 5.3l1.3-1.3c.4-.4.9-.5 1.4-.3l2.6 1.1c.5.2.8.7.7 1.2l-.5 2.6c-.1.6-.6 1-1.2 1A15.2 15.2 0 0 1 3 6.7c0-.6.4-1.1 1-1.2z" />
            </svg>
          </div>
        </div>
        </div>
        </div>
        <aside className="vd-consult-side" aria-label="Visit information" style={{ display: 'none' }}>
          <div style={{ background: 'var(--vd-surface-card)', border: '1px solid var(--vd-glass-border)', borderRadius: 20, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--vd-ink-3)' }}>This visit</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--vd-ink-1)', marginTop: 6 }}>{consult.status === 'idle' ? 'Not started yet' : 'Live with Dr. Mira'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--vd-ink-3)', marginTop: 4, lineHeight: 1.5 }}>Speak or type — everything lands in your consultation notes.</div>
          </div>
          <div style={{ background: 'var(--vd-surface-card)', border: '1px solid var(--vd-glass-border)', borderRadius: 20, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--vd-ink-3)' }}>Good to know</div>
            <div style={{ fontSize: 12.5, color: 'var(--vd-ink-2)', marginTop: 6, lineHeight: 1.6 }}>Your Penicillin allergy is on file and respected. A licensed doctor reviews every plan.</div>
          </div>
        </aside>
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
        width: 44, height: 44, borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: off ? 'var(--vd-bad-bg)' : on ? gradients.primary : surfaces.card,
        color: off ? 'var(--vd-bad-fg)' : on ? '#fff' : ink.onGlass,
        boxShadow: '0 3px 10px rgba(46,37,71,.2)',
      }}
    >
      {children}
    </div>
  );
}
