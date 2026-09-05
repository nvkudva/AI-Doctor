// Decline bottom sheet: reason chips + editable note shown to the patient.
import { Button, Chip, Sheet } from '../../../lib/ui';
import s from './DeclineSheet.module.css';

const REASONS: { chip: string; text: string }[] = [
  { chip: 'Needs in-person exam', text: 'Needs an in-person examination — please show this consult at the hospital front desk.' },
  { chip: 'Missing information', text: 'We need a bit more information — please start a fresh consult and describe the symptoms in detail.' },
  { chip: 'Wrong specialty — reroute', text: 'This needs a different specialty — please show this consult at the hospital front desk for rerouting.' },
];

export function DeclineSheet({ open, reason, onReason, onCancel, onConfirm }: {
  open: boolean; reason: string; onReason: (r: string) => void; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title="Not approving this case?"
      label="Not approving this case"
      footer={(
        <>
          <Button variant="tertiary" onClick={onCancel} style={{ flex: 1 }}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} style={{ flex: 1 }}>Don’t approve</Button>
        </>
      )}
    >
      <div className={s.lede}>
        The patient will see your reason, written kindly, with a next step.
      </div>
      <div className={s.reasons}>
        {REASONS.map(r => (
          <Chip key={r.chip} selected={reason === r.text} onSelect={() => onReason(r.text)}>{r.chip}</Chip>
        ))}
      </div>
      <textarea
        value={reason}
        aria-label="Reason shown to the patient"
        onChange={e => onReason(e.target.value)}
        rows={3}
        className={s.note}
      />
    </Sheet>
  );
}
