// The demo half of the clinic store: queue, records, notices and review state
// on seeds + localStorage, with no backend anywhere. Selected by ClinicProvider
// when no Supabase project is configured; unchanged from the pre-backend app.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CaseItem, ConsultStatus } from '../lib/core';
import { persistLocal, restoreLocal, type LocalSnapshot, type ReviewDecision } from '../lib/api';
import { Ctx } from './context';
import { buildSchedule, pendingCheckIn } from './doses';
import { seedDoctorSlots, seedLabValues } from './seeds';
import { slaSweep } from './sla';
import type { AppointmentSlot, Clinic, ClinicSeeds, ConsultDetail, HealthProfile, Notice, UserConsult, UserRx } from './types';

// The full plan, in the shape History already knows how to expand (UX-04).
function recDetail(c: CaseItem): ConsultDetail {
  const rec = c.rec;
  const items = rec.items || [];
  return {
    summary: rec.summary || c.summary,
    evaluation: (c.inferred || []).join('; ') || rec.title,
    advice: rec.advice,
    tests: items.filter(i => !(i.dosage && i.dosage.trim())).map(i => ({ name: i.name, detail: i.why || i.detail || i.timing })),
    rx: items.filter(i => !!(i.dosage && i.dosage.trim())).map(i => ({ name: i.name, dosage: i.dosage, timing: i.timing })),
  };
}

export function LocalClinic({ seedQueue, seedConsults, seedRx, seedProfile, children }: ClinicSeeds & { children: ReactNode }) {
  const [saved] = useState<LocalSnapshot | null>(() => restoreLocal());
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>(() => saved?.decisions || {});
  const [queue, setQueue] = useState<CaseItem[]>(() => {
    const base = saved?.liveQueue?.length ? [...saved.liveQueue, ...seedQueue] : seedQueue;
    // Replay stored decisions so a reload cannot resurrect a signed case (UX-02).
    const d = saved?.decisions;
    return d ? base.map(c => (d[c.id] ? { ...c, ...d[c.id] } as CaseItem : c)) : base;
  });
  const [consults, setConsults] = useState<UserConsult[]>(() =>
    saved?.consultsAdd?.length ? [...(saved.consultsAdd as UserConsult[]), ...seedConsults] : seedConsults,
  );
  const [prescriptions, setPrescriptions] = useState<UserRx[]>(() =>
    saved?.rxAdd?.length ? [...(saved.rxAdd as UserRx[]), ...seedRx] : seedRx,
  );
  const [notices, setNotices] = useState<Notice[]>(() => (
    saved?.notices
      ? (saved.notices as Notice[])
      : [{ t: 'New AI case awaiting review', d: 'Maria Gonzalez', kind: 'case', at: Date.now() - 14 * 60000, caseId: 'c1' }]
  ));
  const [profile, setProfileState] = useState<HealthProfile>(() =>
    (saved?.profile as HealthProfile) || seedProfile || { age: '', blood: '', allergies: '' },
  );
  const [appointments, setAppointments] = useState<AppointmentSlot[]>(() => [
    ...seedDoctorSlots, ...((saved?.booked as AppointmentSlot[]) || []),
  ]);
  const [taken, setTaken] = useState<Record<string, boolean>>(() => saved?.doses || {});
  const [checkIns, setCheckIns] = useState<Record<string, string>>(() => saved?.checkIns || {});
  const [liveCaseId, setLiveCaseId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState('idle');
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    persistLocal({ liveQueue: queue.filter(c => c.mine) });
  }, [queue]);
  useEffect(() => { persistLocal({ doses: taken }); }, [taken]);
  useEffect(() => { persistLocal({ checkIns }); }, [checkIns]);
  useEffect(() => { persistLocal({ booked: appointments.filter(a => a.id.startsWith('bk-')) }); }, [appointments]);

  const doses = useMemo(() => buildSchedule(prescriptions, taken), [prescriptions, taken]);
  const checkIn = useMemo(() => pendingCheckIn(queue, checkIns), [queue, checkIns]);
  useEffect(() => {
    persistLocal({ consultsAdd: consults.filter(c => c.user) });
  }, [consults]);
  useEffect(() => {
    persistLocal({ rxAdd: prescriptions.filter(p => p.user) });
  }, [prescriptions]);
  useEffect(() => {
    persistLocal({ decisions });
  }, [decisions]);
  useEffect(() => {
    persistLocal({ notices });
  }, [notices]);
  useEffect(() => {
    persistLocal({ profile });
  }, [profile]);

  const value = useMemo<Clinic>(() => ({
    queue, appointments, labs: seedLabValues, doses, checkIn,
    consults, prescriptions, notices, profile, liveCaseId, reviewStatus, rejectReason,

    addLiveCase: (c) => {
      setQueue(q => [c, ...q]);
      setLiveCaseId(c.id);
      setReviewStatus('pending');
      setRejectReason('');
    },

    setReview: (status, reason = '') => {
      setReviewStatus(status);
      setRejectReason(reason);
    },

    setLiveCaseId,

    decide: (id, decision, opts = {}) => {
      const now = Date.now();
      const status: ConsultStatus = decision === 'approved' ? 'approved' : decision === 'changes' ? 'changes' : 'rejected';
      const reason = opts.reason || '';
      const c = queue.find(x => x.id === id);
      const stamp: ReviewDecision = {
        status, decision, reviewedBy: 'Dr. Whitfield', reviewedAt: now,
        rejectReason: reason || c?.rejectReason,
      };
      setQueue(q => q.map(x => (x.id === id ? { ...x, ...stamp } as CaseItem : x)));
      // Durable the moment it is made — including on seeded cases, which are
      // not part of the persisted liveQueue (UX-02).
      setDecisions(d => ({ ...d, [id]: stamp }));
      if (c && c.id === liveCaseId) {
        setReviewStatus(decision === 'approved' ? 'approved' : decision === 'changes' ? 'changes' : 'rejected');
        setRejectReason(reason);
      }
      // A decision writes records for the *case's* patient. The local snapshot
      // only holds the signed-in demo patient's own record, so a case that is
      // not theirs must never file a prescription or consult against them
      // (QA-01).
      if (!c || !c.mine) return;
      const rec = c.rec;
      if (decision === 'approved') {
        if (rec.type === 'prescription' && rec.items[0]) {
          setPrescriptions(p => [{ name: rec.items[0].name, detail: rec.items[0].detail, date: 'Today', user: true }, ...p]);
        }
        // The record carries the whole plan, so the patient can re-read what
        // they were prescribed long after the plan screen is gone (UX-04).
        setConsults(s => [{
          id: `live-${now}`, title: rec.title, date: 'Today', status: 'Approved',
          note: rec.advice, user: true, detail: recDetail(c),
        }, ...s]);
        setNotices(n => [{
          t: 'Dr. Whitfield approved your plan', d: rec.title, kind: 'review',
          at: now, caseId: c.id,
        }, ...n]);
        return;
      }
      // A decline is not a dead end: it leaves a record the patient can find
      // and a notice that points back at it (UX-05, UX-06).
      const declined = decision === 'rejected';
      setConsults(s => [{
        id: `live-${now}`, title: rec.title, date: 'Today',
        status: declined ? 'Not approved' : 'Being updated',
        note: declined
          ? (reason || 'Your doctor could not approve this plan online.')
          : 'Dr. Whitfield is adjusting this plan. You will see the final version here.',
        user: true, detail: recDetail(c),
      }, ...s]);
      setNotices(n => [{
        t: declined ? 'Dr. Whitfield could not approve your plan' : 'Dr. Whitfield is updating your plan',
        d: declined ? (reason || 'Open the plan to see what to do next.') : rec.title,
        kind: 'review', at: now, caseId: c.id,
      }, ...n]);
    },

    updateRec: (id, rec) => {
      setQueue(q => q.map(c => (c.id === id
        ? { ...c, rec, title: rec.title || c.title, editedBy: 'Dr. Whitfield', editedAt: Date.now() }
        : c)));
    },

    pushNotice: (n) => setNotices(s => [{ at: Date.now(), ...n }, ...s]),

    dismissNotice: (index) => setNotices(s => s.filter((_, i) => i !== index)),

    addConsultRecord: (c) => setConsults(s => [c, ...s]),

    setSlotStatus: (id, status) => setAppointments(a => a.map(x => (x.id === id ? { ...x, status } : x))),

    bookSlot: (title, startsAt, location) => setAppointments(a => [...a, {
      id: `bk-${startsAt}`, patient: title, reason: title, kind: 'imaging',
      startsAt, minutes: 15, location, status: 'booked',
    }]),

    setDoseTaken: (id, t) => setTaken(d => ({ ...d, [id]: t })),

    answerCheckIn: (answer) => {
      if (!checkIn) return;
      setCheckIns(c => ({ ...c, [checkIn.consultId]: answer }));
    },

    // Escalation is a decision like any other: the case leaves the queue and a
    // slot appears in the book carrying the consult with it.
    escalateCase: (id, startsAt, kind, location) => {
      const c = queue.find(x => x.id === id);
      if (!c) return;
      setAppointments(a => [...a, {
        id: `esc-${id}`, patient: c.patient, consultId: id,
        kind, startsAt, minutes: kind === 'video' ? 15 : 20, location, status: 'booked',
      }]);
      const stamp: ReviewDecision = {
        status: 'rejected', decision: 'escalated',
        reviewedBy: 'Dr. Whitfield', reviewedAt: Date.now(),
        rejectReason: 'Escalated to an appointment.',
      };
      setQueue(q => q.map(x => (x.id === id ? { ...x, ...stamp } as CaseItem : x)));
      setDecisions(d => ({ ...d, [id]: stamp }));
    },

    setProfile: setProfileState,

    slaTick: () => {
      const { next, changed, notify, expiredLive } = slaSweep(queue, liveCaseId);
      if (changed) setQueue(next);
      if (notify) setNotices(s => [{ t: 'Waiting longest — a case needs review', d: 'A patient consult has been waiting', kind: 'case' }, ...s]);
      if (expiredLive) {
        setReviewStatus('expired');
      }
    },
  }), [queue, appointments, doses, checkIn, consults, prescriptions, notices, profile, liveCaseId, reviewStatus, rejectReason]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
