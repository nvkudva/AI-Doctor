// Clinic store: queue, records, notices, review state with local persistence.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CaseItem, ConsultStatus } from '../lib/core';
import { persistLocal, restoreLocal, type LocalSnapshot, type ReviewDecision } from '../lib/api';
import { slaSweep } from './sla';
import type { Clinic, ConsultDetail, HealthProfile, Notice, UserConsult, UserRx } from './types';

const Ctx = createContext<Clinic | null>(null);

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

export function useClinic(): Clinic {
  const v = useContext(Ctx);
  if (!v) throw new Error('useClinic outside ClinicProvider');
  return v;
}

export function ClinicProvider({ seedQueue, seedConsults, seedRx, seedProfile, children }: {
  seedQueue: CaseItem[];
  seedConsults: UserConsult[];
  seedRx: UserRx[];
  /** What is genuinely on file for this account; blank fields when nothing is. */
  seedProfile?: HealthProfile;
  children: ReactNode;
}) {
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
  const [liveCaseId, setLiveCaseId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState('idle');
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    persistLocal({ liveQueue: queue.filter(c => c.mine) });
  }, [queue]);
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
    queue, consults, prescriptions, notices, profile, liveCaseId, reviewStatus, rejectReason,

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

    setProfile: setProfileState,

    slaTick: () => {
      const { next, changed, notify, expiredLive } = slaSweep(queue, liveCaseId);
      if (changed) setQueue(next);
      if (notify) setNotices(s => [{ t: 'Waiting longest — a case needs review', d: 'A patient consult has been waiting', kind: 'case' }, ...s]);
      if (expiredLive) {
        setReviewStatus('expired');
      }
    },
  }), [queue, consults, prescriptions, notices, profile, liveCaseId, reviewStatus, rejectReason]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
