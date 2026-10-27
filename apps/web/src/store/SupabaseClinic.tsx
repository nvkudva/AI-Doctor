// The live half of the clinic store. Same 14-member `Clinic` surface as the
// demo half — the screens cannot tell the two apart — but every field is
// assembled from docs/DATA-MODEL.md §4 calls through lib/api.
//
// Nothing clinical is decided here: approve / reject / revise are RPCs, and the
// database refuses any of them that the §3.4 gate would not allow.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { decisionStatus, resolveTenantSlug, splitPlan, stampDecision, type CaseItem, type Recommendation } from '../lib/core';
import {
  approveConsult, escalateConsult, getDoctorAppointments, getMyAppointments, getMyCurrentDrafts, getMyLabs,
  getMyRecords, getMyReviewOutcomes, getNotifications, getPatientDetails, getProfiles,
  getReviewQueue, markNotificationRead, openConsult, rejectConsult, resolveHospitalId,
  reviseDraft, savePatientDetails, setAppointmentStatus, shortDate,
  subscribeQueue, toCaseItem, toLabValue, toNotice, toUserConsult, toUserRx, ageFromDob, describeAllergies,
  type AiDraftRow, type AppointmentRow, type ConsultRow, type DbConsultStatus,
  type PrescriptionRow, type ReviewOutcomeRow,
} from '../lib/api';
import { useAuth } from '../shell/auth';
import { Ctx } from './context';
import { useDeviceState } from './useDeviceState';
import type { AppointmentSlot, Clinic, ClinicSeeds, HealthProfile, LabValue, Notice, UserConsult, UserRx } from './types';

/** §4.2 row 18: the documented fallback when the channel cannot be held. */
const QUEUE_POLL_MS = 30_000;
/** §4.1 row 5 is a poll by design — only while the patient has one open. */
const CONSULT_POLL_MS = 15_000;

const OPEN_DB: DbConsultStatus[] = ['active', 'pending_review', 'needs_human'];

function reviewStatusOf(s: DbConsultStatus): string {
  if (s === 'approved') return 'approved';
  if (s === 'rejected' || s === 'escalated') return 'rejected';
  if (s === 'expired' || s === 'abandoned') return 'expired';
  return 'pending';
}

/** The patient's own lines, split on whether they arrived after submission. */
function patientSaid(bundle: any, after: boolean): string[] {
  const cut = bundle?.consult?.submitted_at ? Date.parse(bundle.consult.submitted_at) : NaN;
  return (bundle?.messages || [])
    .filter((m: any) => m.sender === 'patient')
    .filter((m: any) => {
      if (!Number.isFinite(cut)) return !after;
      return Date.parse(m.created_at) > cut ? after : !after;
    })
    .map((m: any) => m.content);
}

export function SupabaseClinic({ seedProfile, children }: ClinicSeeds & { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id || '';
  const isDoctor = user?.role === 'doctor';

  const [queue, setQueue] = useState<CaseItem[]>([]);
  const [consults, setConsults] = useState<UserConsult[]>([]);
  const [prescriptions, setPrescriptions] = useState<UserRx[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [profile, setProfileState] = useState<HealthProfile>(
    seedProfile || { age: '', blood: '', allergies: '' },
  );
  const [appointments, setAppointments] = useState<AppointmentSlot[]>([]);
  const [labs, setLabs] = useState<LabValue[]>([]);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const device = useDeviceState({ queue, prescriptions, setQueue, setNotices, setConsults, setAppointments });
  const { doses, checkIn, justAnswered, liveCaseId, reviewStatus, rejectReason, setLiveCaseId, setReviewStatus, setRejectReason } = device;

  // The draft a decision must be signed against. §4.2 rows 21–24 all take the
  // draft id *and* its hash, so a doctor can never sign a version they did not
  // read: the database raises `draft_changed` if it has moved underneath them.
  const drafts = useRef<Record<string, { id: string; hash: string }>>({});
  // Cases decided in this session, kept on screen after they leave the pending
  // queue so the desk can still show what was just sent (UX-02, UX-24).
  const decided = useRef<CaseItem[]>([]);

  // ------------------------------------------------------------------ doctor


  const refreshAppointments = useCallback(async (id: string, asDoctor: boolean) => {
    const rows = asDoctor ? await getDoctorAppointments(id) : await getMyAppointments(id);
    const names = await getProfiles([...new Set(rows.map(r => r.patient_id))]);
    const nameOf = new Map(names.map(p => [p.id, p.full_name || 'Patient']));
    setAppointments(rows.map((r: AppointmentRow) => ({
      id: r.id,
      patient: nameOf.get(r.patient_id) || 'Patient',
      patientId: r.patient_id,
      consultId: r.consult_id,
      kind: r.kind,
      startsAt: new Date(r.starts_at).getTime(),
      minutes: r.duration_minutes,
      location: r.location || '',
      status: r.status,
    })));
  }, []);

  const refreshQueue = useCallback(async () => {
    const hospitalId = await resolveHospitalId(resolveTenantSlug(location.hostname, location.search));
    const rows = await getReviewQueue(hospitalId);
    const names = await getProfiles([...new Set(rows.map(r => r.patient_id))]);
    const nameOf = new Map(names.map(p => [p.id, p.full_name || 'Patient']));
    const live = rows.map((row) => {
      const draft = (row.ai_drafts || []).find((d: AiDraftRow) => !d.superseded_at) || null;
      if (draft) drafts.current[row.id] = { id: draft.id, hash: draft.content_hash };
      return toCaseItem({ consult: row, draft, patientName: nameOf.get(row.patient_id) });
    });
    const liveIds = new Set(live.map(c => c.id));
    setQueue([...live, ...decided.current.filter(c => !liveIds.has(c.id))]);
  }, []);

  // §4.2 row 19 — selecting a case opens it: the RPC claims it for this doctor,
  // writes the `doctor_opened` trace row, and returns the whole bundle the case
  // pane needs (transcript, labs, prior consults, the patient's record).
  const { pathname } = useLocation();
  const opened = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isDoctor || !uid) return;
    const id = /\/case\/([^/]+)/.exec(pathname)?.[1];
    if (!id || opened.current.has(id)) return;
    opened.current.add(id);
    openConsult(id).then((bundle) => {
      const draft = bundle.draft;
      if (draft) drafts.current[id] = { id: draft.id, hash: draft.content_hash };
      setQueue(q => q.map(c => (c.id === id ? toCaseItem({
        consult: bundle.consult,
        draft,
        loaded: true,
        patientName: bundle.patient?.profile?.full_name || c.patient,
        details: bundle.patient?.details,
        labs: bundle.labs || [],
        priorConsults: (bundle.prior_consults || []).map(p => ({
          title: p.chief_complaint || 'Consult', date: shortDate(p.created_at), note: p.status,
        })),
        // Anything the patient said after the plan was submitted is not part of
        // the consult the draft was built from, so it is kept apart rather than
        // folded into the transcript the doctor reads as the visit.
        transcript: patientSaid(bundle, false),
        addedAfter: patientSaid(bundle, true),
      }) : c)));
    }).catch(e => console.warn('[vd] could not open case:', e));
  }, [pathname, isDoctor, uid]);

  // ----------------------------------------------------------------- patient

  const refreshPatient = useCallback(async () => {
    if (!uid) return;
    const [rows, outcomes, currentDrafts, labRows, details, notifications] = await Promise.all([
      getMyRecords(uid),
      getMyReviewOutcomes().catch(() => [] as ReviewOutcomeRow[]),
      getMyCurrentDrafts().catch(() => [] as AiDraftRow[]),
      getMyLabs(uid).catch(() => []),
      getPatientDetails(uid).catch(() => null),
      getNotifications(uid).catch(() => []),
    ]);
    const draftOf = new Map(currentDrafts.map(d => [d.consult_id, d]));
    const outcomeOf = new Map(outcomes.map(o => [o.consult_id, o]));
    for (const d of currentDrafts) drafts.current[d.consult_id] = { id: d.id, hash: d.content_hash };

    const priorConsults = rows.map(r => ({
      title: r.chief_complaint || 'Consult',
      date: new Date(r.created_at).toLocaleDateString(),
      note: '',
    }));
    setQueue(rows
      .filter(r => draftOf.has(r.id) || OPEN_DB.includes(r.status))
      .map(r => toCaseItem({
        consult: r as ConsultRow,
        draft: draftOf.get(r.id) || null,
        patientName: user?.name || 'You',
        details,
        labs: labRows,
        priorConsults,
        outcome: outcomeOf.get(r.id) || null,
        mine: true,
      })));
    setConsults(rows.map(r => toUserConsult(r, draftOf.get(r.id) || null, outcomeOf.get(r.id) || null)) as UserConsult[]);
    setPrescriptions(rows.flatMap(r => (r.prescriptions || []).flatMap((p: PrescriptionRow) => toUserRx(p))) as UserRx[]);
    setNotices(notifications.map(toNotice) as Notice[]);
    setLabs(labRows.map(toLabValue));
    if (details) {
      setProfileState({
        age: ageFromDob(details.dob),
        blood: details.blood_group || '',
        allergies: describeAllergies(details),
      });
    }
    // The consult the patient is living through right now owns the review
    // banner; a decided one only does so until they start another.
    const open = rows.find(r => OPEN_DB.includes(r.status)) || rows[0];
    if (open) {
      setLiveCaseId(open.id);
      setReviewStatus(reviewStatusOf(open.status));
      setRejectReason(outcomeOf.get(open.id)?.patient_message || '');
    }
  }, [uid, user?.name]);

  // The first fetch decides whether the screens may speak. A failure is said
  // out loud rather than drawn as an empty, reassuring dashboard (D4); later
  // background refreshes keep the rows already on screen and never re-blank it.
  const refresh = useCallback(() => {
    const run = isDoctor ? refreshQueue : refreshPatient;
    run()
      .then(() => setLoad('ready'))
      .catch(e => {
        console.warn('[vd] clinic refresh failed:', e);
        setLoad(prev => (prev === 'ready' ? prev : 'error'));
      });
    if (uid) refreshAppointments(uid, isDoctor).catch(e => console.warn('[vd] appointments failed:', e));
  }, [isDoctor, uid, refreshQueue, refreshPatient, refreshAppointments]);

  const retry = useCallback(() => {
    setLoad('loading');
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!uid) return;
    refresh();
  }, [uid, refresh]);

  // §4.2 row 18 — the doctor's queue is live, not polled. The 30 s poll only
  // exists for the documented case where the channel errors.
  useEffect(() => {
    if (!uid || !isDoctor) return;
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPoll = () => {
      if (poll) return;
      console.warn('[vd] realtime queue channel unavailable — falling back to a 30 s poll');
      poll = setInterval(refresh, QUEUE_POLL_MS);
    };
    let stop = () => {};
    let cancelled = false;
    resolveHospitalId(resolveTenantSlug(location.hostname, location.search))
      .then((h) => {
        if (cancelled) return;
        stop = subscribeQueue(h, refresh, () => { if (!cancelled) startPoll(); });
      })
      .catch(() => { if (!cancelled) startPoll(); });
    return () => {
      cancelled = true;
      stop();
      if (poll) clearInterval(poll);
    };
  }, [uid, isDoctor, refresh]);

  // §4.1 row 5 — poll the patient's own consult while one is open.
  useEffect(() => {
    if (!uid || isDoctor) return;
    const open = queue.some(c => c.status === 'active' || c.status === 'pending_review');
    if (!open) return;
    const t = setInterval(refresh, CONSULT_POLL_MS);
    return () => clearInterval(t);
  }, [uid, isDoctor, queue, refresh]);

  const value = useMemo<Clinic>(() => ({
    queue, appointments, labs, doses, checkIn, consults, prescriptions, notices, profile, liveCaseId, reviewStatus, rejectReason,
    load, retry, justAnswered,

    // The consult already exists server-side — `start_consult` opened it and
    // `ai-consult` wrote the draft. All this does is show it and pull the real
    // rows in behind it.
    ...device.actions,
    addLiveCase: (c) => device.actions.addLiveCase(c, refresh),

    decide: (id, decision, opts = {}) => {
      const c = queue.find(x => x.id === id);
      const signed = drafts.current[id];
      const reason = opts.reason || '';
      const stamped = c ? { ...c, ...stampDecision(decision, user?.name || 'Your doctor', reason || c.rejectReason) } as CaseItem : null;
      if (stamped) {
        decided.current = [stamped, ...decided.current.filter(x => x.id !== id)];
        setQueue(q => q.map(x => (x.id === id ? stamped : x)));
      }
      if (c && c.id === liveCaseId) {
        setReviewStatus(decisionStatus(decision));
        setRejectReason(reason);
      }
      // 'changes' is the desk's own state: §3.2 has no transition for it, and a
      // half-edited draft must stay in the queue rather than reach anyone.
      if (decision === 'changes' || !c || !signed) return;

      const plan = splitPlan(c.rec.items || []);
      const call = decision === 'approved'
        ? approveConsult({
          consultId: id, draftId: signed.id, draftHash: signed.hash,
          finalItems: plan.rx,
          investigations: plan.tests,
          advice: c.rec.advice || '',
          idempotencyKey: `approve:${id}:${signed.id}`,
        })
        : rejectConsult({
          consultId: id, draftId: signed.id, draftHash: signed.hash,
          reason: reason || 'not approvable online',
          patientMessage: reason || 'Your doctor could not approve this plan online.',
          idempotencyKey: `reject:${id}:${signed.id}`,
        });

      call.then(refresh).catch((e) => {
        // The decision did not happen. Say so rather than leaving a card that
        // claims a prescription was sent.
        console.warn('[vd] decision refused:', e);
        decided.current = decided.current.filter(x => x.id !== id);
        if (c) setQueue(q => q.map(x => (x.id === id ? c : x)));
        setNotices(n => [{
          t: 'That decision did not go through',
          d: e?.code === 'draft_changed'
            ? 'The plan changed while you were reading it — open the case again.'
            : (e?.message || 'The case is unchanged. Please try again.'),
          kind: 'case', at: Date.now(), caseId: id,
        }, ...n]);
        refresh();
      });
    },

    // §4.2 row 21 — a revision is a new immutable draft version, not an edit.
    updateRec: (id, rec: Recommendation) => {
      const base = drafts.current[id];
      setQueue(q => q.map(c => (c.id === id
        ? { ...c, rec, title: rec.title || c.title, editedBy: user?.name || 'Your doctor', editedAt: Date.now() }
        : c)));
      if (!base) return;
      reviseDraft(id, base.id, rec as any)
        .then((r) => { drafts.current[id] = { id: r.draft_id, hash: r.content_hash }; })
        .catch((e) => {
          console.warn('[vd] revision refused:', e);
          refresh();
        });
    },

    // §4.1 row 15 — dismissing marks the row read; the trigger allows nothing else.
    dismissNotice: (index) => {
      const n = notices[index];
      setNotices(s => s.filter((_, i) => i !== index));
      if (n?.id) markNotificationRead(n.id).catch(() => { /* stays unread server-side */ });
    },

    // Attendance is a plain column update — RLS decides whether it lands.
    setSlotStatus: (id, status) => {
      setAppointments(a => a.map(x => (x.id === id ? { ...x, status } : x)));
      setAppointmentStatus(id, status).catch((e) => {
        console.warn('[vd] attendance refused:', e);
        if (uid) refreshAppointments(uid, isDoctor).catch(() => { /* left as it was */ });
      });
    },

    // §4.2 row 24 — the one decision that books instead of signing. The RPC
    // writes the review, the appointment and the state change in one place.
    escalateCase: (id, startsAt, kind, location) => {
      const c = queue.find(x => x.id === id);
      const signed = drafts.current[id];
      if (c) {
        const stamped = {
          ...c, ...stampDecision('escalated', user?.name || 'Your doctor', 'Escalated to an appointment.'),
        } as CaseItem;
        decided.current = [stamped, ...decided.current.filter(x => x.id !== id)];
        setQueue(q => q.map(x => (x.id === id ? stamped : x)));
      }
      if (!c || !signed) return;
      escalateConsult({
        consultId: id, draftId: signed.id, draftHash: signed.hash,
        reason: 'Needs to be seen in person.',
        appointment: { starts_at: new Date(startsAt).toISOString(), kind, location },
        idempotencyKey: `escalate:${id}:${signed.id}`,
      })
        .then(() => { if (uid) return refreshAppointments(uid, true); })
        .catch((e) => {
          console.warn('[vd] escalation refused:', e);
          refresh();
        });
    },

    // §4.1 row 3 — the 18+ check is a database trigger; a bad age is refused there.
    setProfile: (p) => {
      setProfileState(p);
      if (!uid) return;
      const patch: Record<string, unknown> = {
        blood_group: p.blood || null,
        allergies: p.allergies
          ? p.allergies.split(',').map(a => a.trim()).filter(Boolean).map(substance => ({ substance, source: 'self_reported' }))
          : [],
      };
      const age = Number(p.age);
      if (Number.isFinite(age) && age > 0 && String(age) !== profile.age) {
        patch.dob = `${new Date().getFullYear() - age}-01-01`;
      }
      savePatientDetails(uid, patch).catch(e => console.warn('[vd] profile not saved:', e));
    },

    // SLA warning, expiry and abandonment are `run_consult_timers()` on the
    // server (§4.3 row 33). The client does not sweep its own queue.
    slaTick: () => {},
  }), [queue, appointments, labs, doses, checkIn, justAnswered, device.actions, consults, prescriptions, notices, profile, liveCaseId, reviewStatus, rejectReason, load, retry, uid, user?.name, refresh, refreshAppointments]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
