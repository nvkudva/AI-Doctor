// Review SLA sweep as a pure function: 2h nudge, 24h expiry for own cases.
import type { CaseItem, ConsultStatus } from '../lib/core';

const HOUR = 3600 * 1000;

export interface SlaResult {
  next: CaseItem[];
  changed: boolean;
  notify: boolean;
  expiredLive: boolean;
}

export function slaSweep(queue: CaseItem[], liveCaseId: string | null, now = Date.now()): SlaResult {
  let notify = false;
  let expiredLive = false;
  const next = queue.map(c => {
    if (!c.mine || !c.submittedAt) return c;
    const age = now - c.submittedAt;
    if ((c.status === 'pending_review' || c.status === 'pending') && age > 24 * HOUR) {
      if (c.id === liveCaseId) expiredLive = true;
      return { ...c, status: 'expired' as ConsultStatus };
    }
    if ((c.status === 'pending_review' || c.status === 'pending') && age > 2 * HOUR && !c.slaNudged) {
      notify = true;
      return { ...c, slaNudged: true };
    }
    return c;
  });
  return { next, changed: next.some((c, i) => c !== queue[i]), notify, expiredLive };
}
