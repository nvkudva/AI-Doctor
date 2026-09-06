// Row types for docs/DATA-MODEL.md §2. Hand-written rather than generated so
// the app builds with no local stack running; field names and nullability
// track §2 exactly.

export type Urgency = 'routine' | 'soon' | 'urgent';
export type Confidence = 'high' | 'medium' | 'low';
export type MemberRole = 'patient' | 'doctor' | 'admin';
export type DbConsultStatus =
  | 'active' | 'pending_review' | 'needs_human' | 'approved'
  | 'rejected' | 'escalated' | 'expired' | 'abandoned' | 'closed';

/** §2.1 — via the `hospitals_public` view (§4.1 row 1). */
export interface HospitalPublic {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  theme: Record<string, unknown> | null;
}

/** §2.2 */
export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

/** §2.3 */
export interface MembershipRow {
  profile_id: string;
  hospital_id: string;
  role: MemberRole;
  status: string;
}

export interface AllergyEntry {
  substance: string;
  class?: string | null;
  severity?: string | null;
  reaction?: string | null;
  source?: string | null;
  recorded_at?: string | null;
}

/** §2.4 */
export interface PatientDetailsRow {
  profile_id: string;
  dob: string | null;
  sex?: string | null;
  blood_group: string | null;
  allergies: AllergyEntry[];
  conditions: { name: string; since?: string; status?: string; source?: string }[];
  medications: { name: string; dose?: string; frequency?: string; source?: string }[];
  self_attested?: boolean;
  updated_at?: string;
}

/** §2.6 */
export interface ConsultRow {
  id: string;
  hospital_id: string;
  patient_id: string;
  status: DbConsultStatus;
  chief_complaint: string | null;
  urgency: Urgency;
  channel_mix?: Record<string, number>;
  working_dx?: { label: string; likelihood?: number; updated_at?: string }[];
  protocol_version_id?: string | null;
  assigned_doctor_id: string | null;
  sla_warned_at: string | null;
  created_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  closed_at: string | null;
  last_patient_turn_at: string | null;
}

/** §2.8 */
export interface ConsultMessageRow {
  id: string;
  consult_id: string;
  seq: number;
  sender: 'patient' | 'ai' | 'doctor' | 'system';
  channel?: string;
  content: string;
  created_at: string;
}

/** Mirrors lib/core Recommendation; §2.11 `recommendation`. */
export interface RecommendationJson {
  type: 'prescription' | 'investigation';
  title: string;
  summary: string;
  items: { name: string; dosage: string; timing: string; notes: string; why: string; detail: string }[];
  advice: string;
  urgency: Urgency;
}

/** §2.11 */
export interface AiDraftRow {
  id: string;
  consult_id: string;
  version: number;
  superseded_at: string | null;
  recommendation: RecommendationJson;
  note: string;
  confidence: Confidence;
  flags: { code: string; severity: string; text: string; source: string }[];
  unanswered_slots: string[];
  model?: string;
  prompt_version?: string;
  content_hash: string;
  created_at: string;
}

/** §2.7 */
export interface ConsultSlotRow {
  slot_id: string;
  status: 'unknown' | 'asked' | 'filled' | 'refused' | 'not_applicable' | 'unanswered';
  value: string | null;
  confidence: number | null;
  source: string;
}

/** §2.19 */
export interface PrescriptionItemRow {
  id: string;
  prescription_id: string;
  position: number;
  name: string;
  dosage: string;
  timing: string;
  duration: string | null;
  notes: string;
  why: string;
  detail: string;
}

/** §2.20 */
export interface InvestigationOrderRow {
  id: string;
  prescription_id: string;
  position?: number;
  name: string;
  why?: string;
  detail?: string;
  status?: string;
}

/** §2.18 */
export interface PrescriptionRow {
  id: string;
  consult_id: string;
  patient_id: string;
  doctor_id: string;
  review_id: string;
  kind: 'prescription' | 'investigation';
  advice: string;
  edited_from_draft: boolean;
  pdf_path: string | null;
  approved_at: string;
  prescription_items?: PrescriptionItemRow[];
  investigation_orders?: InvestigationOrderRow[];
}

/** §2.21 */
export interface LabResultRow {
  id: string;
  patient_id: string;
  panel: string;
  analyte: string;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  abnormal: 'normal' | 'low' | 'high' | 'critical' | 'unknown';
  observed_at: string;
  report_path: string | null;
}

/** §2.23 */
export interface NotificationRow {
  id: string;
  recipient_id: string;
  consult_id: string | null;
  kind: 'case_queued' | 'decision' | 'sla_delay' | 'expired' | 'appointment' | 'system';
  title: string;
  body: string;
  deep_link: string | null;
  read_at: string | null;
  created_at: string;
}

/** `my_review_outcomes` view (§2.16 subset a patient may read). */
export interface ReviewOutcomeRow {
  id: string;
  consult_id: string;
  action: 'approved' | 'rejected' | 'escalated';
  reason: string | null;
  patient_message: string | null;
  created_at: string;
}

// --------------------------------------------------------------- RPC payloads

/** §4.1 row 4 */
export interface StartConsultResult { consult_id: string; status: DbConsultStatus; resumed: boolean }

/** §4.2 row 19 — the `open_consult` bundle. */
export interface CaseBundle {
  consult: ConsultRow;
  patient: { profile: ProfileRow | null; details: PatientDetailsRow | null } | null;
  draft: AiDraftRow | null;
  slots: ConsultSlotRow[];
  messages: ConsultMessageRow[];
  safety: { id: string; kind: string; outcome: string; detail: unknown }[];
  labs: LabResultRow[];
  prior_consults: { id: string; chief_complaint: string | null; status: string; created_at: string }[];
}

/** §4.2 row 21 */
export interface ReviseDraftResult { draft_id: string; version: number; content_hash: string }
/** §4.2 row 22 */
export interface ApproveResult { review_id: string; prescription_id: string; status: string }
/** §4.2 rows 23–24 */
export interface DecisionResult { review_id: string; status?: string; appointment_id?: string }

/** §4.1 row 8 / §4.2 row 27 — voice-token. */
export interface VoiceSession {
  token: string;
  expires_at: string;
  session_config_hash: string;
  ws_url?: string;
  model?: string;
  mode?: 'patient' | 'coordinator';
  start_by?: string;
  start_window_seconds?: number;
  session_minutes?: number;
}

/** §4.1 row 7 — the `done` event of ai-consult. */
export interface ConsultTurnDone {
  message_id: string | null;
  slots_changed: string[];
  draft_id: string | null;
  status: DbConsultStatus;
  emergency?: boolean;
  safety?: unknown;
  gate?: string;
}

/** §4.2 row 20 — the `done` event of ai-review. */
export interface ReviewTurnDone {
  review_message_id: string | null;
  citations: unknown[];
  proposed_draft: RecommendationJson | null;
}

/** The §4 error envelope, uniform across E and R. */
export interface ApiErrorShape {
  code: string;
  message: string;
  detail?: unknown;
  retryable?: boolean;
}
