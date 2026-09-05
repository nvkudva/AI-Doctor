// The patient header bell. Same component as the doctor desk, but narrowed to
// notices about this patient's own cases — the queue is shared.
import { useMemo, useState } from 'react';
import { NotifyButton } from '../../../lib/ui';
import { useClinic } from '../../../store';

export function PatientNotify() {
  const clinic = useClinic();
  const [open, setOpen] = useState(false);
  // Keep the original indices: dismissNotice addresses the unfiltered list.
  const rows = useMemo(() => {
    const mine = new Set(clinic.queue.filter(c => c.mine).map(c => c.id));
    return clinic.notices
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => (n.caseId ? mine.has(n.caseId) : true));
  }, [clinic.notices, clinic.queue]);
  return (
    <NotifyButton
      notices={rows.map(r => r.n)}
      open={open}
      onToggle={() => setOpen(o => !o)}
      onClose={() => setOpen(false)}
      onDismiss={i => clinic.dismissNotice(rows[i].i)}
    />
  );
}
