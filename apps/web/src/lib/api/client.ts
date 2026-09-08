// docs/DATA-MODEL.md §4, one function per row. Table reads (T) go through
// PostgREST under RLS, RPCs (R) through rpc/, Edge Functions (E) through
// functions/v1 with the caller's JWT, live updates (S) through Realtime.
//
// No endpoint here is invented: each is labelled with the §4 row it implements.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { anonKey, functionsBase } from './env';
import { requireSupabase, supabase } from './supabase';
import type {
  AiDraftRow, ApiErrorShape, AppointmentRow, ApproveResult, CaseBundle, ConsultMessageRow, ConsultRow,
  ConsultTurnDone, DecisionResult, HospitalPublic, LabResultRow, MembershipRow, NotificationRow,
  PatientDetailsRow, PrescriptionRow, ProfileRow, RecommendationJson, ReviewOutcomeRow,
  ReviewTurnDone, ReviseDraftResult, StartConsultResult, VoiceSession,
} from './types';

/** The §4 error envelope as a throwable. */
export class ApiError extends Error implements ApiErrorShape {
  code: string;
  detail?: unknown;
  retryable?: boolean;
  status?: number;
  constructor(shape: ApiErrorShape & { status?: number }) {
    super(shape.message || shape.code);
    this.code = shape.code;
    this.detail = shape.detail;
    this.retryable = shape.retryable;
    this.status = shape.status;
  }
}

/** PostgREST raises `PTnnn` SQLSTATEs; MESSAGE carries the code, DETAIL the text. */
function fromPostgrest(e: { code?: string; message?: string; details?: string; hint?: string } | null): ApiError {
  const sqlstate = String(e?.code ?? '');
  const status = /^PT\d{3}$/.test(sqlstate) ? Number(sqlstate.slice(2)) : undefined;
  return new ApiError({
    code: e?.message || sqlstate || 'request_failed',
    message: e?.details || e?.message || 'request failed',
    detail: e?.hint,
    retryable: status === 503 || status === 429,
    status,
  });
}

function unwrap<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw fromPostgrest(res.error);
  return res.data as T;
}

async function authHeaders(): Promise<Record<string, string>> {
  const sb = requireSupabase();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError({ code: 'unauthenticated', message: 'no active session', status: 401 });
  return { authorization: `Bearer ${token}`, apikey: anonKey(), 'content-type': 'application/json' };
}

// ------------------------------------------------------------------ §4.1 patient

/** §4.1 row 1 — resolve tenant branding (anon). */
export async function getHospitalBySlug(slug: string): Promise<HospitalPublic | null> {
  const sb = supabase();
  if (!sb) return null;
  return unwrap(await sb.from('hospitals_public').select('id,slug,name,logo_url,theme').eq('slug', slug).maybeSingle());
}

/** Which hospital this account belongs to, when the slug does not resolve one. */
export async function myMemberships(): Promise<MembershipRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb.from('memberships').select('profile_id,hospital_id,role,status').eq('status', 'active')) || [];
}

/** §4.1 row 2 — my profile + details. */
export async function getPatientDetails(profileId: string): Promise<PatientDetailsRow | null> {
  const sb = requireSupabase();
  return unwrap(await sb.from('patient_details').select('*').eq('profile_id', profileId).maybeSingle());
}

/** §4.1 row 3 — save health profile. */
export async function savePatientDetails(profileId: string, patch: Partial<PatientDetailsRow>): Promise<PatientDetailsRow> {
  const sb = requireSupabase();
  return unwrap(await sb.from('patient_details').update(patch).eq('profile_id', profileId).select('*').single());
}

/** §4.1 row 4 — start or resume a consult. */
export async function startConsult(hospitalId: string): Promise<StartConsultResult> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('start_consult', { p_hospital_id: hospitalId })) as StartConsultResult;
}

/** §4.1 row 5 — consult state, with the current draft from `my_current_draft`. */
export async function getConsult(consultId: string): Promise<{ consult: ConsultRow | null; draft: AiDraftRow | null }> {
  const sb = requireSupabase();
  const consult = unwrap(await sb.from('consults').select('*').eq('id', consultId).maybeSingle()) as ConsultRow | null;
  const draft = unwrap(await sb.from('my_current_draft').select('*').eq('consult_id', consultId).maybeSingle()) as AiDraftRow | null;
  return { consult, draft };
}

/** §4.1 row 5, all at once — every consult of mine that still has a live draft. */
export async function getMyCurrentDrafts(): Promise<AiDraftRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb.from('my_current_draft').select('*')) || [];
}

/** §4.1 row 6 — transcript. */
export async function getTranscript(consultId: string): Promise<ConsultMessageRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb.from('consult_messages').select('*').eq('consult_id', consultId).order('seq')) || [];
}

/** §4.1 row 10 — my records: consults with their signed plans. */
export async function getMyRecords(patientId: string): Promise<(ConsultRow & { prescriptions: PrescriptionRow[] })[]> {
  const sb = requireSupabase();
  return unwrap(await sb
    .from('consults')
    .select('*,prescriptions(*,prescription_items(*),investigation_orders(*))')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })) || [];
}

/** The patient-visible outcome of each review (`my_review_outcomes`, §2.16). */
export async function getMyReviewOutcomes(): Promise<ReviewOutcomeRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb.from('my_review_outcomes').select('*').order('created_at', { ascending: false })) || [];
}

/** §4.1 row 11 — one prescription with its items. */
export async function getPrescription(id: string): Promise<PrescriptionRow | null> {
  const sb = requireSupabase();
  return unwrap(await sb.from('prescriptions').select('*,prescription_items(*),investigation_orders(*)').eq('id', id).maybeSingle());
}

/** §4.1 row 12 — a signed link to the prescription PDF (300 s). */
export async function signPrescriptionPdf(prescriptionId: string): Promise<{ url: string; expires_at: string }> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('sign_prescription_pdf', { p_prescription_id: prescriptionId })) as { url: string; expires_at: string };
}

/** §4.1 row 13 — my labs. */
export async function getMyLabs(patientId: string): Promise<LabResultRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb.from('lab_results').select('*').eq('patient_id', patientId).order('observed_at', { ascending: false })) || [];
}

/** §4.1 row 14 — notifications. */
export async function getNotifications(recipientId: string): Promise<NotificationRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb.from('notifications').select('*').eq('recipient_id', recipientId).order('created_at', { ascending: false })) || [];
}

/** §4.1 row 15 — mark read (the trigger allows `read_at` and nothing else). */
export async function markNotificationRead(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw fromPostgrest(error);
}

// ------------------------------------------------------------------- §4.2 doctor

/** §4.2 row 17 — the review queue, newest draft attached. */
export async function getReviewQueue(hospitalId: string): Promise<(ConsultRow & { ai_drafts: AiDraftRow[] })[]> {
  const sb = requireSupabase();
  return unwrap(await sb
    .from('consults')
    .select('*,ai_drafts(*)')
    .eq('hospital_id', hospitalId)
    .in('status', ['pending_review', 'needs_human'])
    .order('urgency', { ascending: false })
    .order('submitted_at', { ascending: true })) || [];
}

/** Every appointment in this doctor's book. The calendar groups them itself. */
export async function getDoctorAppointments(doctorId: string): Promise<AppointmentRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb
    .from('appointments')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('starts_at', { ascending: true })) || [];
}

/** The patient's own appointments — RLS scopes this to their rows. */
export async function getMyAppointments(patientId: string): Promise<AppointmentRow[]> {
  const sb = requireSupabase();
  return unwrap(await sb
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('starts_at', { ascending: true })) || [];
}

/**
 * The only column a clinician moves on a booked slot. Attendance is a fact
 * recorded after the fact, so it is a plain update, not an RPC.
 */
export async function setAppointmentStatus(
  id: string,
  status: AppointmentRow['status'],
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('appointments').update({ status }).eq('id', id);
  if (error) throw fromPostgrest(error);
}

/** Names for the queue cards. A doctor may read a profile they share a consult with. */
export async function getProfiles(ids: string[]): Promise<ProfileRow[]> {
  if (!ids.length) return [];
  const sb = requireSupabase();
  const { data, error } = await sb.from('profiles').select('id,full_name,email').in('id', ids);
  if (error) return [];
  return (data as ProfileRow[]) || [];
}

/**
 * §4.2 row 18 — queue live updates. Returns an unsubscribe. `onError` fires when
 * the channel cannot be held, so the caller can fall back to the documented
 * 30 s poll.
 */
export function subscribeQueue(
  hospitalId: string,
  onChange: () => void,
  onError: () => void,
): () => void {
  const sb = supabase();
  if (!sb) return () => {};
  let channel: RealtimeChannel | null = null;
  try {
    channel = sb
      .channel(`queue:${hospitalId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consults', filter: `hospital_id=eq.${hospitalId}` }, () => onChange())
      .subscribe((status) => {
        // CLOSED is also what a deliberate unsubscribe reports, so only the
        // two genuine failures trigger the §4.2 row 18 fallback.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError();
      });
  } catch {
    onError();
  }
  return () => {
    try {
      if (channel) sb.removeChannel(channel);
    } catch { /* already gone */ }
  };
}

/** §4.2 row 19 — open a case; returns the whole bundle. */
export async function openConsult(consultId: string): Promise<CaseBundle> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('open_consult', { p_consult_id: consultId })) as CaseBundle;
}

/** §4.2 row 21 — persist a revision. 409 on a superseded base, 422 on a safety block. */
export async function reviseDraft(consultId: string, baseDraftId: string, recommendation: RecommendationJson): Promise<ReviseDraftResult> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('revise_draft', {
    p_consult_id: consultId, p_base_draft_id: baseDraftId, p_recommendation: recommendation,
  })) as ReviseDraftResult;
}

/** §4.2 row 22 — approve. The only write path to `prescriptions`. */
export async function approveConsult(args: {
  consultId: string; draftId: string; draftHash: string;
  finalItems: RecommendationJson['items']; investigations: RecommendationJson['items'];
  advice: string; idempotencyKey: string;
}): Promise<ApproveResult> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('approve_consult', {
    p_consult_id: args.consultId, p_draft_id: args.draftId, p_draft_hash: args.draftHash,
    p_final_items: args.finalItems, p_investigations: args.investigations,
    p_advice: args.advice, p_idempotency_key: args.idempotencyKey,
  })) as ApproveResult;
}

/** §4.2 row 23 — reject. `patient_message` is required by the database. */
export async function rejectConsult(args: {
  consultId: string; draftId: string; draftHash: string;
  reason: string; patientMessage: string; idempotencyKey: string;
}): Promise<DecisionResult> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('reject_consult', {
    p_consult_id: args.consultId, p_draft_id: args.draftId, p_draft_hash: args.draftHash,
    p_reason: args.reason, p_patient_message: args.patientMessage, p_idempotency_key: args.idempotencyKey,
  })) as DecisionResult;
}

/** §4.2 row 24 — escalate to an appointment. */
export async function escalateConsult(args: {
  consultId: string; draftId: string; draftHash: string; reason: string;
  appointment: { starts_at: string; kind: string; location?: string }; idempotencyKey: string;
}): Promise<DecisionResult> {
  const sb = requireSupabase();
  return unwrap(await sb.rpc('escalate_consult', {
    p_consult_id: args.consultId, p_draft_id: args.draftId, p_draft_hash: args.draftHash,
    p_reason: args.reason, p_appointment: args.appointment, p_idempotency_key: args.idempotencyKey,
  })) as DecisionResult;
}

/** §4.2 row 25 — the patient record panel a treating doctor may read. */
export async function getPatientPanel(profileId: string): Promise<PatientDetailsRow | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('patient_details').select('*').eq('profile_id', profileId).maybeSingle();
  if (error) return null;
  return data as PatientDetailsRow | null;
}

/** §4.2 row 26 — feedback to Mira. */
export async function sendMiraFeedback(row: { consult_id: string; draft_id?: string; rating: string; comment?: string }): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('mira_feedback').insert(row);
  if (error) throw fromPostgrest(error);
}

// -------------------------------------------------------------- Edge Functions

/** SSE reader shared by ai-consult and ai-review. */
async function streamFunction<T>(
  name: 'ai-consult' | 'ai-review',
  body: unknown,
  onToken?: (t: string) => void,
): Promise<T> {
  const res = await fetch(`${functionsBase()}/${name}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    let shape: ApiErrorShape = { code: 'request_failed', message: `${name} failed (${res.status})` };
    try {
      shape = (await res.json()) as ApiErrorShape;
    } catch { /* non-JSON error body */ }
    throw new ApiError({ ...shape, status: res.status });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let done: T | null = null;
  let failed: ApiError | null = null;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buf += decoder.decode(chunk.value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() ?? '';
    for (const frame of frames) {
      const ev = /^event: (.*)$/m.exec(frame)?.[1];
      const raw = /^data: (.*)$/m.exec(frame)?.[1];
      if (!ev || !raw) continue;
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      if (ev === 'token') onToken?.(String(data.token ?? ''));
      else if (ev === 'done') done = data as T;
      else if (ev === 'error') failed = new ApiError(data as ApiErrorShape);
    }
  }
  if (failed) throw failed;
  if (!done) throw new ApiError({ code: 'stream_incomplete', message: 'the assistant stream ended early', retryable: true });
  return done;
}

/** §4.1 row 7 — send a patient turn. Streams tokens, resolves on `done`. */
export function aiConsult(
  args: { consultId: string; text?: string; channel?: 'voice' | 'text' },
  onToken?: (t: string) => void,
): Promise<ConsultTurnDone> {
  return streamFunction<ConsultTurnDone>('ai-consult', {
    consult_id: args.consultId, text: args.text ?? '', channel: args.channel ?? 'text',
  }, onToken);
}

/** §4.2 row 20 — ask Mira / dictate an edit. */
export function aiReview(
  args: { consultId: string; text: string; mode: 'qa' | 'revise' },
  onToken?: (t: string) => void,
): Promise<ReviewTurnDone> {
  return streamFunction<ReviewTurnDone>('ai-review', {
    consult_id: args.consultId, text: args.text, mode: args.mode,
  }, onToken);
}

/**
 * §4.1 row 8 / §4.2 row 27 — mint a voice session credential. The provider key
 * stays inside the Edge Function; the browser only ever holds this single-use
 * ephemeral token.
 */
export async function mintVoiceToken(consultId: string, mode?: 'coordinator'): Promise<VoiceSession> {
  const res = await fetch(`${functionsBase()}/voice-token`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(mode ? { consult_id: consultId, mode } : { consult_id: consultId }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError({ ...(data as ApiErrorShape ?? { code: 'voice_token_failed', message: 'could not mint a voice session' }), status: res.status });
  return data as VoiceSession;
}

// ------------------------------------------------------------------- tenancy

let hospitalId: string | null = null;

/**
 * The hospital this session acts in. §4.1 row 1 is the only sanctioned source,
 * so the tenant slug is tried first and `VITE_TENANT_SLUG` second — the latter
 * exists because localhost has no tenant subdomain to parse. `memberships` is a
 * last resort and is normally refused: the table carries policies but no SELECT
 * grant to `authenticated`. Memoized — it cannot change without a reload.
 */
export async function resolveHospitalName(slug?: string): Promise<string | null> {
  const fallbackSlug = (import.meta.env.VITE_TENANT_SLUG as string | undefined) || '';
  for (const candidate of [slug, fallbackSlug]) {
    if (!candidate) continue;
    const h = await getHospitalBySlug(candidate).catch(() => null);
    if (h) return h.name;
  }
  return null;
}

export async function resolveHospitalId(slug?: string): Promise<string> {
  if (hospitalId) return hospitalId;
  const fallbackSlug = (import.meta.env.VITE_TENANT_SLUG as string | undefined) || '';
  for (const candidate of [slug, fallbackSlug]) {
    if (!candidate) continue;
    const h = await getHospitalBySlug(candidate).catch(() => null);
    if (h) {
      hospitalId = h.id;
      return hospitalId;
    }
  }
  const mine = await myMemberships().catch(() => [] as MembershipRow[]);
  const first = mine[0];
  if (!first) throw new ApiError({ code: 'no_membership', message: 'this account belongs to no hospital', status: 403 });
  hospitalId = first.hospital_id;
  return hospitalId;
}

export function forgetHospitalId(): void {
  hospitalId = null;
}
