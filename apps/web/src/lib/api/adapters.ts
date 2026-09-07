// §6 M3 — adapters, not rewrites. Normalized §2 rows in, the view models the
// screens already render out (CaseItem, UserConsult, UserRx, Notice, LabResult).
// If a screen would have to change, the adapter is wrong, not the screen.
import type { CaseItem, ConsultStatus, LabResult, PastConsult, Recommendation, SafetyFlag } from '../core';
import type {
  AiDraftRow, ConsultRow, DbConsultStatus, LabResultRow, NotificationRow,
  PatientDetailsRow, PrescriptionRow, ReviewOutcomeRow,
} from './types';

const EMPTY_REC: Recommendation = {
  type: 'investigation', title: 'Awaiting plan', summary: '',
  items: [], advice: '', urgency: 'routine',
};

/** §3.2's enum, projected onto the lifecycle the UI already knows. */
export function toUiStatus(s: DbConsultStatus): ConsultStatus {
  switch (s) {
    case 'active': return 'active';
    case 'pending_review': return 'pending_review';
    case 'needs_human': return 'pending_review';
    case 'approved': return 'approved';
    case 'rejected': return 'rejected';
    case 'escalated': return 'rejected';
    case 'expired': return 'expired';
    case 'abandoned': return 'abandoned';
    // A closed consult is finished and no longer actionable; the queue treats
    // it exactly like an expired one.
    default: return 'expired';
  }
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function waitLabel(iso: string | null): string {
  if (!iso) return 'Just now';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
}

/** §2.21 → the four fields the labs list renders. */
export function toLabResult(r: LabResultRow): LabResult {
  const value = r.value_text ?? (r.value_num !== null ? `${r.value_num}${r.unit ? ' ' + r.unit : ''}` : '—');
  return {
    name: r.analyte || r.panel,
    date: shortDate(r.observed_at),
    result: value,
    ok: r.abnormal === 'normal',
  };
}

/** The full §2.21 row — value, unit and the range it is judged against. */
export function toLabValue(r: LabResultRow) {
  return {
    id: r.id,
    panel: r.panel,
    analyte: r.analyte || r.panel,
    value: r.value_num,
    text: r.value_text,
    unit: r.unit || '',
    refLow: r.ref_low,
    refHigh: r.ref_high,
    abnormal: r.abnormal,
    observedAt: new Date(r.observed_at).getTime(),
    reportPath: r.report_path,
  };
}

export function describeAllergies(d: PatientDetailsRow | null | undefined): string {
  return (d?.allergies ?? []).map(a => a.substance).filter(Boolean).join(', ');
}

export function ageFromDob(dob: string | null | undefined): string {
  if (!dob) return '';
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age > 0 ? String(age) : '';
}

/** §6 M3 — the doctor's queue card and case pane, from normalized rows. */
export function toCaseItem(args: {
  consult: ConsultRow;
  draft?: AiDraftRow | null;
  patientName?: string;
  details?: PatientDetailsRow | null;
  labs?: LabResultRow[];
  priorConsults?: PastConsult[];
  transcript?: string[];
  outcome?: ReviewOutcomeRow | null;
  reviewerName?: string;
  mine?: boolean;
}): CaseItem {
  const { consult, draft } = args;
  const rec = (draft?.recommendation as Recommendation | undefined) ?? EMPTY_REC;
  const allergies = describeAllergies(args.details);
  const age = ageFromDob(args.details?.dob);
  const demo = [age && `${age}`, args.details?.blood_group].filter(Boolean).join(' · ');
  const labs = (args.labs ?? []).map(toLabResult);
  // The severity is what makes a flag readable at a glance on the desk, so the
  // validator's verdict is carried through whole rather than flattened to text.
  const flags: SafetyFlag[] = (draft?.flags ?? [])
    .filter(f => f.text || f.code)
    .map(f => ({
      code: f.code || 'check',
      severity: (f.severity === 'block' || f.severity === 'warn' ? f.severity : 'info') as SafetyFlag['severity'],
      text: f.text || f.code,
      source: f.source || 'validator',
    }));
  const dx = (consult.working_dx ?? []).map(d => d.label).filter(Boolean);
  // A closed consult that carries a review outcome reads as that outcome: the
  // decision is what the patient and the desk care about, not the housekeeping
  // status the timers left behind.
  const status = args.outcome && (consult.status === 'closed' || consult.status === 'expired')
    ? (args.outcome.action === 'approved' ? 'approved' as const : 'rejected' as const)
    : toUiStatus(consult.status);
  return {
    id: consult.id,
    mine: args.mine,
    submittedAt: new Date(consult.submitted_at || consult.created_at).getTime(),
    patient: args.patientName || 'Patient',
    demo: demo || 'No demographics on file',
    title: rec.title || consult.chief_complaint || 'Consult',
    meta: `${waitLabel(consult.submitted_at || consult.created_at)} · ${consult.urgency}`,
    status,
    summary: draft?.note || consult.chief_complaint || '',
    symptoms: args.transcript ?? [],
    history: allergies ? `Allergic to ${allergies}.` : 'No allergies or history on file for this patient.',
    confidence: draft?.confidence ?? 'medium',
    flags,
    stated: args.transcript ?? [],
    inferred: dx.length ? dx : [rec.title].filter(Boolean),
    observation: consult.channel_mix && consult.channel_mix.voice_turns
      ? `${consult.channel_mix.voice_turns} spoken turns in this consult.`
      : '',
    rec,
    relevantLabs: labs,
    pastLabs: labs,
    pastConsults: args.priorConsults ?? [],
    reviewedBy: args.outcome ? (args.reviewerName || 'Your doctor') : undefined,
    reviewedAt: args.outcome ? new Date(args.outcome.created_at).getTime() : undefined,
    decision: args.outcome?.action,
    rejectReason: args.outcome?.patient_message || undefined,
  };
}

/** §4.1 row 10 → the History list. */
export function toUserConsult(
  consult: ConsultRow & { prescriptions?: PrescriptionRow[] },
  draft?: AiDraftRow | null,
  outcome?: ReviewOutcomeRow | null,
) {
  const rx = (consult.prescriptions ?? [])[0];
  const rec = draft?.recommendation;
  const status = consult.status === 'approved' ? 'Approved'
    : consult.status === 'rejected' ? 'Not approved'
      : consult.status === 'escalated' ? 'Referred'
        : consult.status === 'pending_review' || consult.status === 'needs_human' ? 'In review'
          : consult.status === 'active' ? 'In progress'
            : 'Closed';
  const items = rx?.prescription_items ?? [];
  const orders = rx?.investigation_orders ?? [];
  return {
    id: consult.id,
    title: rec?.title || consult.chief_complaint || 'Consult',
    date: shortDate(consult.submitted_at || consult.created_at),
    status,
    note: outcome?.patient_message || rx?.advice || rec?.advice || '',
    user: true,
    detail: {
      summary: rec?.summary || consult.chief_complaint || '',
      evaluation: (consult.working_dx ?? []).map(d => d.label).join('; ') || rec?.title || '',
      advice: rx?.advice || rec?.advice || '',
      tests: orders.map(o => ({ name: o.name, detail: o.detail || o.why || '' })),
      rx: items.map(i => ({ name: i.name, dosage: i.dosage, timing: i.timing })),
    },
  };
}

/** §2.19 → the medication cards. Only signed items ever reach this list. */
export function toUserRx(p: PrescriptionRow) {
  return (p.prescription_items ?? []).map(i => ({
    name: i.name,
    detail: [i.dosage, i.timing].filter(Boolean).join(' · ') || i.detail,
    date: shortDate(p.approved_at),
    user: true,
    nextDose: i.timing || undefined,
  }));
}

/** §2.23 → the notification list. `id` is carried so a dismissal can mark read. */
export function toNotice(n: NotificationRow) {
  return {
    t: n.title,
    d: n.body,
    kind: n.kind === 'decision' ? 'review' : 'case',
    at: new Date(n.created_at).getTime(),
    caseId: n.consult_id || undefined,
    id: n.id,
  };
}
