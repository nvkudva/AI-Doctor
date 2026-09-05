import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CaseItem, ConsultStatus, Recommendation } from '@vd/core';
import { persistLocal, restoreLocal, type LocalSnapshot } from '@vd/api';

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
}

export interface Notice {
  t: string; d: string; kind: string; at?: number; caseId?: string;
}

interface Clinic {
  queue: CaseItem[];
  consults: UserConsult[];
  prescriptions: UserRx[];
  notices: Notice[];
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
  slaTick: () => void;
}

const Ctx = createContext<Clinic | null>(null);

export function useClinic(): Clinic {
  const v = useContext(Ctx);
  if (!v) throw new Error('useClinic outside ClinicProvider');
  return v;
}

const HOUR = 3600 * 1000;

export function ClinicProvider({ seedQueue, seedConsults, seedRx, children }: {
  seedQueue: CaseItem[];
  seedConsults: UserConsult[];
  seedRx: UserRx[];
  children: ReactNode;
}) {
  const [saved] = useState<LocalSnapshot | null>(() => restoreLocal());
  const [queue, setQueue] = useState<CaseItem[]>(() =>
    saved?.liveQueue?.length ? [...saved.liveQueue, ...seedQueue] : seedQueue,
  );
  const [consults, setConsults] = useState<UserConsult[]>(() =>
    saved?.consultsAdd?.length ? [...(saved.consultsAdd as UserConsult[]), ...seedConsults] : seedConsults,
  );
  const [prescriptions, setPrescriptions] = useState<UserRx[]>(() =>
    saved?.rxAdd?.length ? [...(saved.rxAdd as UserRx[]), ...seedRx] : seedRx,
  );
  const [notices, setNotices] = useState<Notice[]>([
    { t: 'New AI case awaiting review', d: 'Maria Gonzalez', kind: 'case', at: Date.now() - 14 * 60000, caseId: 'c1' },
  ]);
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

  const value = useMemo<Clinic>(() => ({
    queue, consults, prescriptions, notices, liveCaseId, reviewStatus, rejectReason,

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
      setQueue(q => q.map(c => (c.id === id
        ? { ...c, status, reviewedBy: 'Dr. Whitfield', reviewedAt: now, decision, rejectReason: opts.reason || c.rejectReason }
        : c)));
      const c = queue.find(x => x.id === id);
      if (c && c.id === liveCaseId) {
        setReviewStatus(decision === 'approved' ? 'approved' : decision === 'changes' ? 'changes' : 'rejected');
        setRejectReason(opts.reason || '');
      }
      if (c && decision === 'approved') {
        const rec = c.rec;
        if (rec.type === 'prescription' && rec.items[0]) {
          setPrescriptions(p => [{ name: rec.items[0].name, detail: rec.items[0].detail, date: 'Today', user: true }, ...p]);
        }
        setConsults(s => [{ id: `live-${now}`, title: rec.title, date: 'Today', status: 'Approved', note: rec.advice, user: true }, ...s]);
      }
    },

    updateRec: (id, rec) => {
      setQueue(q => q.map(c => (c.id === id
        ? { ...c, rec, title: rec.title || c.title, editedBy: 'Dr. Whitfield', editedAt: Date.now() }
        : c)));
    },

    pushNotice: (n) => setNotices(s => [{ at: Date.now(), ...n }, ...s]),

    dismissNotice: (index) => setNotices(s => s.filter((_, i) => i !== index)),

    addConsultRecord: (c) => setConsults(s => [c, ...s]),

    slaTick: () => {
      const now = Date.now();
      let notify = false;
      let expiredLive = false;
      const next = queue.map(c => {
        if (!c.mine || !c.submittedAt) return c;
        const age = now - c.submittedAt;
        if ((c.status === 'pending_review' || c.status === 'pending') && age > 24 * HOUR) {
          if (c.id === liveCaseId) expiredLive = true;
          return { ...c, status: 'expired' as ConsultStatus };
        }
        if ((c.status === 'pending_review' || c.status === 'pending') && age > 2 * HOUR && !c.slaNudged) {
          notify = true;
          return { ...c, slaNudged: true };
        }
        return c;
      });
      const changed = next.some((c, i) => c !== queue[i]);
      if (changed) setQueue(next);
      if (notify) setNotices(s => [{ t: 'Waiting longest — a case needs review', d: 'A patient consult has been waiting', kind: 'case' }, ...s]);
      if (expiredLive) {
        setReviewStatus('expired');
      }
    },
  }), [queue, consults, prescriptions, notices, liveCaseId, reviewStatus, rejectReason]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
