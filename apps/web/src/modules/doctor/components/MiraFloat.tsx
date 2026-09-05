// Floating Dr. Mira review assistant: orb button + voice/text review panel.
import { useState } from 'react';
import { Icon, MiraPresence, pressProps, useDismiss } from '../../../lib/ui';
import { z } from '../../../lib/theme';
import type { useReview } from '../useReview';

export function MiraFloat({ review, onEdit, mobile }: { review: ReturnType<typeof useReview>; onEdit: (() => void) | null; mobile: boolean }) {
  const [open, setOpen] = useState(false);
  useDismiss(() => setOpen(false), open);
  return (
    <>
      {!open && (
      <div
        {...pressProps(() => setOpen(true), 'Open Dr. Mira')}
        aria-expanded={open}
        title="Dr. Mira"
        style={{
          cursor: 'pointer', position: 'fixed', zIndex: z.popover, right: mobile ? 12 : 20, bottom: mobile ? 12 : 20,
          width: 60, height: 60, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(28,24,55,.85)', backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: '1px solid rgba(255,255,255,.2)', boxShadow: '0 12px 32px rgba(20,12,60,.5), 0 0 24px oklch(0.72 0.2 300 / .45)',
        }}
      >
        <MiraPresence voiceState={review.status} size={38} />
        {review.active && (
          <span style={{ position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 99, background: 'oklch(0.72 0.2 145)', border: '2px solid rgba(28,24,55,.9)' }} />
        )}
      </div>
      )}
      {open && (
        <div role="dialog" aria-label="Dr. Mira chat" style={{ position: 'fixed', zIndex: z.popover, right: mobile ? 12 : 20, bottom: mobile ? 80 : 88, width: 'min(380px, calc(100vw - 24px))', height: 'min(600px, calc(100dvh - 170px))', display: 'flex', flexDirection: 'column', borderRadius: 22, overflow: 'hidden', background: 'rgba(28,24,55,.9)', backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)', border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 24px 60px rgba(12,8,40,.55)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px 10px 16px', borderBottom: '1px solid rgba(255,255,255,.12)', flex: 'none' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', flex: 1 }}>Dr. Mira</div>
            <div {...pressProps(() => setOpen(false), 'Close chat')} style={{ cursor: 'pointer', width: 44, height: 44, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.85)', fontSize: 18 }}>×</div>
          </div>
          <div className="vd-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
            <ReviewPanel review={review} onEdit={onEdit} mobile={mobile} />
          </div>
        </div>
      )}
    </>
  );
}

function ReviewPanel({ review, onEdit, mobile }: { review: ReturnType<typeof useReview>; onEdit: (() => void) | null; mobile: boolean }) {
  const [input, setInput] = useState('');
  const send = () => {
    if (!input.trim()) return;
    review.command(input);
    setInput('');
  };
  return (
    <div style={mobile ? { flex: 'none', width: '100%', minWidth: 0, borderRadius: 22, background: 'rgba(28,24,55,.78)', backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)', border: '1px solid rgba(255,255,255,.14)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' } : { flex: '1 1 280px', minWidth: 0, alignSelf: 'flex-start', position: 'sticky', top: 12, borderRadius: 22, background: 'rgba(28,24,55,.78)', backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)', border: '1px solid rgba(255,255,255,.14)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <MiraPresence voiceState={review.status} size={mobile ? 72 : 92} onTap={review.orbTap} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', textAlign: 'center' }}>Dr. Mira</div>
      <div style={{ fontSize: 13, color: 'var(--vd-ink-on-brand)', minHeight: 40 }}>{review.line || 'Start the review and I’ll walk you through this case — change the tests, prescription, or advice by voice or text, or approve to send it to the patient.'}</div>
      <div className="vd-scroll" style={{ maxHeight: 320, overflowY: 'auto', fontSize: 12.5, color: 'var(--vd-ink-on-brand)' }}>
        {review.notes.map((n, i) => (
          <div key={i} style={{ marginBottom: 6 }}><b>{n.who}:</b> {n.t}</div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>Voice edits update the draft — nothing is sent until you approve.</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['Approve it', 'Add CBC', 'Change advice'].map(c => (
          <div key={c} {...pressProps(() => review.command(c), c)} style={{ cursor: 'pointer', background: 'rgba(255,255,255,.85)', borderRadius: 99, padding: '10px 13px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: '#3A2E5C' }}>
            {c}
          </div>
        ))}
        {review.failedCmd && (
          <div onClick={() => review.command(review.failedCmd!)} style={{ cursor: 'pointer', background: 'var(--vd-bad-bg)', borderRadius: 99, padding: '10px 13px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: 'var(--vd-bad-fg)' }}>
            Retry last command
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          aria-label="Type to Mira"
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type to Mira…"
          style={{ flex: 1, border: 0, borderRadius: 99, height: 44, padding: '0 16px', fontSize: 16 }}
        />
        <button onClick={send} aria-label="Send to Mira" style={{ cursor: 'pointer', border: 0, width: 44, height: 44, borderRadius: 99, background: 'rgba(255,255,255,.9)', color: '#241B45', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}><Icon name="send" size={18} /></button>
      </div>
      <button onClick={review.active ? review.stop : review.start} style={{ cursor: 'pointer', border: 0, height: 48, borderRadius: 99, background: 'rgba(255,255,255,.92)', fontSize: 15, fontWeight: 700, color: '#241B45', fontFamily: 'inherit' }}>
        {review.active ? 'End review' : 'Talk'}
      </button>
      {onEdit && (
        <button onClick={onEdit} style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,.5)', height: 48, borderRadius: 99, background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--vd-ink-on-brand)', fontFamily: 'inherit' }}>
          Send back for changes
        </button>
      )}
    </div>
  );
}
