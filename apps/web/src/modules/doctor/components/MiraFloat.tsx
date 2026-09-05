// Dr. Mira in coordinator mode (PRD MC-1/MC-3): the shared <MiraPresence> plus
// the doctor's review controls as its suggestion/action slot. No second voice UI.
import { useState } from 'react';
import { Button, Card, Chip, IconButton, MicroLabel, MiraPresence, Sheet } from '../../../lib/ui';
import { useBreakpoint } from '../../../shell/viewport';
import { ink, lines, radius, space, surfaces, type, z } from '../../../lib/theme';
import type { useReview } from '../useReview';

export function MiraFloat({ review, onEdit, open, onOpen, onClose }: {
  review: ReturnType<typeof useReview>;
  onEdit: (() => void) | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  // Below 800 the bottom-nav FAB is the entry point, so no floating orb.
  const edge = bp === 'tablet' ? 24 : 28;
  const panel = <ReviewPanel review={review} onEdit={onEdit} />;
  return (
    <>
      {!mobile && !open && (
        <>
          <MiraPresence minimized voiceState={review.status} onMaximize={onOpen} />
          {review.active && (
            <span
              aria-hidden="true"
              style={{
                position: 'fixed', zIndex: z.nav, right: edge + 2, bottom: `calc(${edge + 48}px + env(safe-area-inset-bottom))`,
                width: 12, height: 12, borderRadius: radius.pill,
                background: 'var(--vd-ok-fg)', border: `2px solid ${lines.glass}`,
              }}
            />
          )}
        </>
      )}
      {open && (mobile ? (
        <Sheet open onClose={onClose} title="Dr. Mira" label="Dr. Mira">{panel}</Sheet>
      ) : (
        <div
          role="dialog"
          aria-label="Dr. Mira"
          style={{
            position: 'fixed', zIndex: z.popover, right: edge, bottom: edge,
            width: 'min(380px, calc(100vw - 48px))', maxHeight: 'min(640px, calc(100dvh - 140px))',
            display: 'flex', animation: 'vd-pop var(--vd-dur-4) var(--vd-ease-overshoot) both',
          }}
        >
          <Card level={5} pad={space[5]} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: space[3], overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
              <div style={{ flex: 1, minWidth: 0 }}><MicroLabel>Dr. Mira</MicroLabel></div>
              <IconButton icon="x" label="Close Dr. Mira" tone="plain" onClick={onClose} />
            </div>
            <div className="vd-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{panel}</div>
          </Card>
        </div>
      ))}
    </>
  );
}

// The doctor-audience suggestion/action slot (MC-3): presence, transcript,
// quick commands, and the explicit review controls.
function ReviewPanel({ review, onEdit }: { review: ReturnType<typeof useReview>; onEdit: (() => void) | null }) {
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const [input, setInput] = useState('');
  const send = () => {
    if (!input.trim()) return;
    review.command(input);
    setInput('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <MiraPresence voiceState={review.status} size={mobile ? 72 : 92} onTap={review.orbTap} />
      </div>
      <div style={{ ...(mobile ? type.callout : type.calloutT), color: ink.body, minHeight: 40 }}>
        {review.line || 'Start the review and I’ll walk you through this case — change the tests, prescription, or advice by voice or text, or approve to send it to the patient.'}
      </div>
      {review.notes.length > 0 && (
        <div className="vd-scroll" style={{ maxHeight: 240, overflowY: 'auto', ...(mobile ? type.footnote : type.footnoteT), color: ink.secondary }}>
          {review.notes.map((n, i) => (
            <div key={i} style={{ marginBottom: space[2] }}><b style={{ color: ink.body }}>{n.who}:</b> {n.t}</div>
          ))}
        </div>
      )}
      <div style={{ ...type.caption, fontWeight: 400, color: ink.soft }}>
        Voice edits update the draft — nothing is sent until you approve.
      </div>
      <div style={{ display: 'flex', gap: space[2], flexWrap: 'wrap' }}>
        {['Approve it', 'Add CBC', 'Change advice'].map(c => (
          <Chip key={c} onSelect={() => review.command(c)}>{c}</Chip>
        ))}
        {review.failedCmd && (
          <Chip
            onSelect={() => review.command(review.failedCmd!)}
            style={{ background: 'var(--vd-bad-bg)', color: 'var(--vd-bad-fg)', border: '1px solid transparent' }}
          >
            Retry last command
          </Chip>
        )}
      </div>
      <div style={{ display: 'flex', gap: space[3] }}>
        <input
          value={input}
          aria-label="Type to Mira"
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type to Mira…"
          style={{
            flex: 1, minWidth: 0, height: 44, padding: `0 ${space[5]}px`, fontSize: 16,
            borderRadius: radius.pill, border: `1px solid ${lines.hairline}`,
            background: surfaces.panel, color: ink.body,
          }}
        />
        <IconButton icon="send" label="Send to Mira" tone="card" onClick={send} size={44} />
      </div>
      <Button variant="primary" fullWidth icon={review.active ? undefined : 'mic'} onClick={review.active ? review.stop : review.start}>
        {review.active ? 'End review' : 'Talk'}
      </Button>
      {onEdit && (
        <Button variant="tertiary" fullWidth onClick={onEdit}>Send back for changes</Button>
      )}
    </div>
  );
}
