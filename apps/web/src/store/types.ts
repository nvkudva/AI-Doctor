// Clinic store record types shared by patient + doctor modules.
import type { CaseItem, Recommendation } from '../lib/core';

export interface ConsultDetail {
  summary: string; evaluation: string; advice: string;
  tests: { name: string; detail: string }[];
  rx: { name: string; dosage: string; timing: string }[];
}

export interface UserConsult {
  id: string; title: string; date: string; status: string; note: string; user?: boolean;
  detail?: ConsultDetail;
}

export interface UserRx {
  name: string; detail: string; date: string; user?: boolean;
  /** Empty for a plan item that is not a drug — a booked test, a diet plan. */
  dosage?: string;
  /** When the next dose is due — drives the home dashboard's medication card. */
  nextDose?: string;
}

export type SlotStatus = 'booked' | 'cancelled' | 'completed' | 'no_show';

/** One booked slot. The doctor's calendar and the patient's Home draw the same
 *  row from opposite ends of it. */
export interface AppointmentSlot {
  id: string;
  patient: string;
  patientId?: string;
  consultId?: string | null;
  kind: 'in_person' | 'video' | 'imaging' | 'lab';
  /** What the slot is for, when it is not simply "see the doctor" — the test a
   *  patient booked. The doctor's calendar keys off `patient`; the patient's own
   *  Home keys off this. */
  reason?: string;
  /** Epoch ms, so the calendar can group and sort without parsing. */
  startsAt: number;
  minutes: number;
  location: string;
  status: SlotStatus;
}

/** One measured value with the range it is judged against (§2.21). */
export interface LabValue {
  id: string;
  panel: string;
  analyte: string;
  value: number | null;
  text: string | null;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  abnormal: 'normal' | 'low' | 'high' | 'critical' | 'unknown';
  observedAt: number;
  reportPath: string | null;
}

/** One dose on the patient's schedule. Kept locally: the schema records what
 *  was prescribed, not what was swallowed. */
export interface Dose {
  id: string;
  rx: string;
  detail: string;
  /** Epoch ms of the dose itself. */
  at: number;
  taken: boolean;
  /** Epoch ms the patient actually recorded it, when they did. */
  takenAt?: number;
  /** Deliberately not taken. */
  skipped?: boolean;
}

/** A day-3 nudge on an approved plan. */
export interface CheckIn {
  consultId: string;
  /** The condition being asked about. */
  title: string;
  /** The plan the patient is rating, named so they can see which one it is. */
  plan: string;
  approvedAt: number;
  /** Other approved plans also awaiting a check-in. Non-empty means the
   *  patient must pick before the options appear (DESIGN-REVIEW D8). */
  alternatives: { id: string; title: string; plan: string }[];
  answer?: 'better' | 'same' | 'worse';
}

/** What the patient can edit about themselves. Blank means "not on file". */
export interface HealthProfile {
  age: string;
  blood: string;
  allergies: string;
}

export interface Notice {
  t: string; d: string; kind: string; at?: number; caseId?: string;
  /** The `notifications` row this came from, when it came from one (§2.23). */
  id?: string;
}

/** What a provider is seeded with when it runs on the demo data. */
export interface ClinicSeeds {
  seedQueue: CaseItem[];
  seedConsults: UserConsult[];
  seedRx: UserRx[];
  /** What is genuinely on file for this account; blank fields when nothing is. */
  seedProfile?: HealthProfile;
}

export interface Clinic {
  queue: CaseItem[];
  appointments: AppointmentSlot[];
  labs: LabValue[];
  doses: Dose[];
  checkIn: CheckIn | null;
  /** The check-in answered in the last minute, so home can confirm it in place
   *  and offer an undo rather than silently dropping the card (D27). */
  justAnswered: { consultId: string; title: string; answer: 'better' | 'same' | 'worse' } | null;
  /** Take back a check-in answer while the confirmation is still showing. */
  undoCheckIn: (consultId: string) => void;
  consults: UserConsult[];
  prescriptions: UserRx[];
  notices: Notice[];
  profile: HealthProfile;
  liveCaseId: string | null;
  /** Whether the rows below can be believed yet. Screens must not render
   *  empty-state copy — least of all reassuring copy — while this is
   *  'loading' (DESIGN-REVIEW D4). */
  load: 'loading' | 'ready' | 'error';
  /** Re-run the failed fetch behind `load === 'error'`. */
  retry: () => void;
  reviewStatus: string;
  rejectReason: string;
  addLiveCase: (c: CaseItem) => void;
  setReview: (status: string, reason?: string) => void;
  setLiveCaseId: (id: string | null) => void;
  decide: (id: string, decision: 'approved' | 'changes' | 'rejected', opts?: { reason?: string }) => void;
  updateRec: (id: string, rec: Recommendation) => void;
  pushNotice: (n: Notice) => void;
  dismissNotice: (index: number) => void;
  addConsultRecord: (c: UserConsult) => void;
  /** Attendance, recorded after the slot has passed. */
  setSlotStatus: (id: string, status: SlotStatus) => void;
  /** Send a case to a booked slot instead of signing it (§4.2 row 24). */
  escalateCase: (id: string, startsAt: number, kind: AppointmentSlot['kind'], location: string) => void;
  /** Patient books an ordered test into a slot. */
  bookSlot: (title: string, startsAt: number, location: string) => void;
  /** Tick a dose off, or untick it. */
  setDoseTaken: (id: string, taken: boolean) => void;
  /** Record a dose as deliberately not taken; false clears it. */
  setDoseSkipped: (id: string, skipped: boolean) => void;
  /** `consultId` names the plan rated, which with several running is not
   *  necessarily the one the sheet opened on (DESIGN-REVIEW D27). */
  answerCheckIn: (answer: 'better' | 'same' | 'worse', consultId?: string) => void;
  setProfile: (p: HealthProfile) => void;
  slaTick: () => void;
}

export type { CaseItem };
