// Doctor landing (mobile Home tab): three counts across the top, then the
// next few cases waiting. Reads nothing the queue doesn't already carry.
import { isReviewable, type CaseItem } from '../../../lib/core';
import { Button, Card, EmptyState, MicroLabel } from '../../../lib/ui';
import { ink, media, space, type } from '../../../lib/theme';
import { QueueCard } from './QueueCard';

export const doctorHomeCss = `
.vd-home-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
${media.tabletUp}{.vd-home-stats{gap:16px}}`;

const NEXT_UP = 3;

export function DoctorHome({ queue, onSelect, onSeeAll }: {
  queue: CaseItem[];
  onSelect: (id: string) => void;
  onSeeAll: () => void;
}) {
  const pending = queue.filter(c => isReviewable(c.status)).length;
  const approved = queue.filter(c => c.status === 'approved').length;
  const urgent = queue.filter(c => c.rec.urgency === 'urgent').length;
  const next = queue.filter(c => isReviewable(c.status)).slice(0, NEXT_UP);
  return (
    <>
      <div className="vd-home-stats">
        <Stat value={pending} label="Pending" tone="var(--vd-warn-fg)" />
        <Stat value={approved} label="Approved" tone="var(--vd-ok-fg)" />
        <Stat value={urgent} label="Urgent" tone="var(--vd-bad-fg)" />
      </div>

      <MicroLabel>Next up</MicroLabel>
      {next.length > 0 ? (
        <>
          {next.map(c => <QueueCard key={c.id} c={c} selected={false} onSelect={() => onSelect(c.id)} />)}
          <Button variant="tertiary" onClick={onSeeAll}>See all appointments</Button>
        </>
      ) : (
        <EmptyState
          icon="check"
          title="Nothing waiting"
          body="Every consult has been reviewed. New ones appear here as they arrive."
          action={<Button variant="tertiary" onClick={onSeeAll}>See all appointments</Button>}
        />
      )}
    </>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <Card style={{ padding: `${space[4]}px ${space[3]}px`, textAlign: 'center' }}>
      <div style={{ ...type.largeTitle, color: tone, lineHeight: 1 }}>{value}</div>
      <div style={{ ...type.caption, color: ink.secondary, marginTop: space[2] }}>{label}</div>
    </Card>
  );
}
