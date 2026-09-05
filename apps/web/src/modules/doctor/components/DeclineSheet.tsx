// Decline bottom sheet: reason chips + editable note shown to the patient.
import { gradients, ink, surfaces, z } from '../../../lib/theme';
import { pressProps, useDismiss } from '../../../lib/ui';

export function DeclineSheet({ reason, onReason, onCancel, onConfirm }: {
  reason: string; onReason: (r: string) => void; onCancel: () => void; onConfirm: () => void;
}) {
  useDismiss(onCancel, true);
  return (
    <div role="dialog" aria-modal="true" aria-label="Not approving this case" style={{ position: 'fixed', inset: 0, zIndex: z.popover, background: 'rgba(23,19,51,.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 18 }}>
      <div style={{ width: 'min(480px,100%)', background: surfaces.card, borderRadius: 20, padding: 20, animation: 'vd-slidein .25s ease both' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: ink.primary }}>Not approving this case?</div>
        <div style={{ fontSize: 13, color: ink.secondary, marginTop: 4 }}>The patient will see your reason, written kindly, with a next step.</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {(['Needs in-person exam', 'Missing information', 'Wrong specialty — reroute'] as const).map(chip => (
            <div
              key={chip}
              {...pressProps(() => onReason(chip === 'Needs in-person exam'
                ? 'Needs an in-person examination — please show this consult at the hospital front desk.'
                : chip === 'Missing information'
                  ? 'We need a bit more information — please start a fresh consult and describe the symptoms in detail.'
                  : 'This needs a different specialty — please show this consult at the hospital front desk for rerouting.'), chip)}
              style={{ cursor: 'pointer', background: surfaces.chip, borderRadius: 99, padding: '10px 13px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: ink.body }}
            >
              {chip}
            </div>
          ))}
        </div>
        <textarea
          value={reason}
          aria-label="Reason shown to the patient"
          onChange={e => onReason(e.target.value)}
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, border: '1px solid var(--vd-border)', borderRadius: 16, padding: '10px 12px', fontSize: 16, fontFamily: 'inherit', color: ink.body, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button autoFocus onClick={onCancel} style={sheetSecondary}>Cancel</button>
          <button onClick={onConfirm} style={sheetDanger}>Don’t approve</button>
        </div>
      </div>
    </div>
  );
}

const sheetSecondary = {
  cursor: 'pointer', flex: 1, border: '1px solid var(--vd-border)', height: 48, borderRadius: 99,
  background: 'transparent', fontSize: 14, fontWeight: 700, color: ink.body, fontFamily: 'inherit',
} as const;

const sheetDanger = {
  cursor: 'pointer', flex: 1, border: 0, height: 48, borderRadius: 99,
  background: gradients.danger, fontSize: 14, fontWeight: 700, color: 'var(--vd-ink-on-brand)', fontFamily: 'inherit',
} as const;
