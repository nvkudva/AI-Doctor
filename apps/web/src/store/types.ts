// Clinic store record types shared by patient + doctor modules.
import type { CaseItem, ConsultStatus, Recommendation } from '../lib/core';

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
  /** When the next dose is due — drives the home dashboard's medication card. */
  nextDose?: string;
}

export interface Appointment {
  id: string; title: string; kind: string; when: string; where: string;
}

/** What the patient can edit about themselves. Blank means "not on file". */
export interface HealthProfile {
  age: string;
  blood: string;
  allergies: string;
}

export interface Notice {
  t: string; d: string; kind: string; at?: number; caseId?: string;
}

export interface Clinic {
  queue: CaseItem[];
  consults: UserConsult[];
  prescriptions: UserRx[];
  notices: Notice[];
  profile: HealthProfile;
  liveCaseId: string | null;
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
  setProfile: (p: HealthProfile) => void;
  slaTick: () => void;
}

export type { CaseItem, ConsultStatus, Recommendation };
