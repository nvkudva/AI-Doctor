// Shown when the recommendation route has no plan (e.g. deep link).
import { Button, EmptyState } from '../../../lib/ui';

export function EmptyRecommendation({ onHome }: { onHome: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <EmptyState
        icon="doc"
        title="No plan to show yet"
        body="Finish a consult and your plan will appear here."
        action={<Button variant="tertiary" onClick={onHome}>Back home</Button>}
      />
    </div>
  );
}
