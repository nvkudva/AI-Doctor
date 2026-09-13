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

export type FlagSeverity = 'block' | 'warn' | 'info';

/** One validator verdict on a draft — allergy, interaction, dose, red flag. */
export interface SafetyFlag {
  code: string; severity: FlagSeverity; text: string; source: string;
}

export interface LabResult { name: string; date: string; result: string; ok: boolean }
export interface PastConsult { title: string; date: string; note: string }

export interface CaseItem {
  id: string; mine?: boolean; submittedAt?: number; slaNudged?: boolean;
  patient: string; demo: string; title: string; meta: string; status: ConsultStatus;
  summary: string; symptoms: string[]; history: string;
  confidence: Confidence; flags: SafetyFlag[];
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

// One derivation of "where has this plan got to", so the home card, the plan
// screen and History cannot disagree about the single most consequential fact
// in the patient app (DESIGN-REVIEW D3). Every consult status collapses onto
// one of these; nothing else is allowed to compute it.
export type PlanStatus = 'pending_review' | 'approved' | 'changes' | 'rejected' | 'expired';

export function planStatus(s: ConsultStatus | string | undefined): PlanStatus {
  switch (s) {
    case 'approved': return 'approved';
    case 'changes': return 'changes';
    case 'rejected': return 'rejected';
    case 'expired': case 'abandoned': return 'expired';
    default: return 'pending_review';
  }
}

/** The patient's own case: the row every patient-side status must be read from. */
export function myCase(queue: CaseItem[]): CaseItem | undefined {
  return queue.find(c => c.mine);
}

export function isReviewable(s: ConsultStatus): boolean {
  return REVIEWABLE.includes(s);
}

export function urgencyRank(c: Pick<CaseItem, 'rec'>): number {
  const u = c.rec?.urgency;
  return u === 'urgent' ? 0 : u === 'soon' ? 1 : 2;
}

/** Unresolved safety flags — 'info' is a check that passed. */
export function concernCount(c: Pick<CaseItem, 'flags'>): number {
  return (c.flags || []).filter(f => f.severity !== 'info').length;
}

// Safety flags first, then urgency, then the longest wait — and the caption
// above the list says exactly this. It used to claim "urgency, then longest
// waiting" while ranking only urgent-vs-everything, so SOON and ROUTINE tied
// and the order read as noise the doctor could not trust (DESIGN-REVIEW D13).
export function sortQueue<T extends Pick<CaseItem, 'rec' | 'submittedAt' | 'flags'>>(q: T[]): T[] {
  return [...q].sort((a, b) =>
    concernCount(b) - concernCount(a)
    || urgencyRank(a) - urgencyRank(b)
    || ((a.submittedAt || 0) - (b.submittedAt || 0)));
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
  if (slug === 'demo') return 'AI Doctor';
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'AI Doctor';
}

/** What activating a queue row does, said in full. Read out, a row's own parts
 *  arrive as disconnected fragments — a name, a phrase, a bare "urgent" — so
 *  both the phone card and the desk row name the case, the decision waiting on
 *  it and what is flagged, in one sentence (DESIGN-REVIEW D32). The wait is
 *  left out: it changes every render, and a name that keeps changing is
 *  re-announced over whatever the reader was listening to. */
export function caseRowLabel(c: {
  patient: string; title: string; flags: { severity: string }[];
  rec: { urgency: string };
}): string {
  const concerns = c.flags.filter(f => f.severity !== 'info').length;
  const parts = [`${c.title}`, c.rec.urgency];
  if (concerns) parts.push(`${concerns} safety flag${concerns === 1 ? '' : 's'}`);
  return `Open ${c.patient}'s case — ${parts.join(', ')}`;
}

/** Whether the tenant resolved to an actual hospital. `tenantDisplayName` falls
 *  back to the product name, which must never be shown in a field labelled
 *  "Hospital" — that is the two-names-for-one-service problem again (D24/D29). */
export function isNamedTenant(hospital: string): boolean {
  return !!hospital && hospital !== 'AI Doctor';
}

/** The window title. One product name, always present: the tab used to flip
 *  between "AI Doctor" and the hospital's name as the tenant resolved, so the
 *  service appeared to have two names (DESIGN-REVIEW D24). */
export function windowTitle(hospital: string): string {
  return isNamedTenant(hospital) ? `${hospital} · AI Doctor` : 'AI Doctor';
}

export * from './time';
