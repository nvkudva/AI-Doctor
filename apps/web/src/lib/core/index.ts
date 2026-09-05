// Domain types, consult lifecycle, tenant parsing. Leaf package: imports nothing internal.

export type Urgency = 'routine' | 'soon' | 'urgent';
export type Confidence = 'high' | 'medium' | 'low';
export type ConsultStatus =
  | 'active' | 'pending' | 'pending_review' | 'approved'
  | 'changes' | 'rejected' | 'expired' | 'abandoned';

export interface RecItem {
  name: string; dosage: string; timing: string;
  notes: string; why: string; detail: string;
}

export interface Recommendation {
  type: 'prescription' | 'investigation';
  title: string; summary: string;
  items: RecItem[]; advice: string; urgency: Urgency;
}

export interface LabResult { name: string; date: string; result: string; ok: boolean }
export interface PastConsult { title: string; date: string; note: string }

export interface CaseItem {
  id: string; mine?: boolean; submittedAt?: number; slaNudged?: boolean;
  patient: string; demo: string; title: string; meta: string; status: ConsultStatus;
  summary: string; symptoms: string[]; history: string;
  confidence: Confidence; flags: string[];
  stated: string[]; inferred: string[]; observation: string;
  rec: Recommendation;
  relevantLabs: LabResult[]; pastLabs: LabResult[]; pastConsults: PastConsult[];
  reviewedBy?: string; reviewedAt?: number; decision?: string;
  editedBy?: string; editedAt?: number; rejectReason?: string;
}

export interface AuditEvent { at: number; consultId: string; actor: string; kind: string; detail: string }

// 'changes' is still the doctor's to finish: it stays in the review queue and
// keeps its decision controls, instead of vanishing into a state nothing in the
// UI can move forward (UX-10).
const OPEN: ConsultStatus[] = ['active', 'pending', 'pending_review', 'changes'];
const REVIEWABLE: ConsultStatus[] = ['pending', 'pending_review', 'changes'];

export function isOpenConsult(s: ConsultStatus): boolean {
  return OPEN.includes(s);
}

export function isReviewable(s: ConsultStatus): boolean {
  return REVIEWABLE.includes(s);
}

export function urgencyRank(c: Pick<CaseItem, 'rec'>): number {
  return c.rec && c.rec.urgency === 'urgent' ? 0 : 1;
}

export function sortQueue<T extends Pick<CaseItem, 'rec' | 'submittedAt'>>(q: T[]): T[] {
  return [...q].sort((a, b) => urgencyRank(a) - urgencyRank(b) || ((a.submittedAt || 0) - (b.submittedAt || 0)));
}

// Tenant parsing only — subdomain wiring lands with hosting (ARCH Phase 6).
export function resolveTenantSlug(hostname: string, search: string): string {
  const q = new URLSearchParams(search).get('hospital');
  if (q) return q.toLowerCase();
  const host = (hostname || '').split('.')[0].toLowerCase();
  if (host && host !== 'localhost' && host !== 'www' && host !== '') return host;
  return 'demo';
}

export function tenantDisplayName(slug: string): string {
  if (slug === 'demo') return 'Virtual Doctor';
  const pretty = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (pretty || 'Virtual Doctor') + ' · Virtual Doctor';
}

export * from './time';
