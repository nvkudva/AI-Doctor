// The patient state that lives on this device in both clinics: dose ticks,
// check-in answers, the live consult's review banner, and the small actions
// that push onto lists the clinic owns. No schema records a swallowed dose or
// a check-in answer, so the first two persist to localStorage (see doses.ts).
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { CaseItem } from '../lib/core';
import { persistLocal, restoreLocal } from '../lib/api';
import { buildSchedule, pendingCheckIn, UNDO_WINDOW } from './doses';
import type { AppointmentSlot, Clinic, Notice, UserConsult, UserRx } from './types';

interface DeviceInputs {
  queue: CaseItem[];
  prescriptions: UserRx[];
  setQueue: Dispatch<SetStateAction<CaseItem[]>>;
  setNotices: Dispatch<SetStateAction<Notice[]>>;
  setConsults: Dispatch<SetStateAction<UserConsult[]>>;
  setAppointments: Dispatch<SetStateAction<AppointmentSlot[]>>;
}

type DeviceActions = Pick<Clinic,
  'setReview' | 'setLiveCaseId' | 'pushNotice' | 'addConsultRecord' | 'bookSlot'
  | 'setDoseTaken' | 'setDoseSkipped' | 'undoCheckIn' | 'answerCheckIn'
> & { addLiveCase: (c: CaseItem, after?: () => void) => void };

export function useDeviceState({ queue, prescriptions, setQueue, setNotices, setConsults, setAppointments }: DeviceInputs) {
  const [saved] = useState(() => restoreLocal());
  const [taken, setTaken] = useState<Record<string, boolean | number>>(() => saved?.doses || {});
  const [skipped, setSkipped] = useState<Record<string, boolean>>(() => saved?.skipped || {});
  const [checkIns, setCheckIns] = useState<Record<string, string>>(() => saved?.checkIns || {});
  const [justAnswered, setJustAnswered] = useState<Clinic['justAnswered']>(null);
  const [liveCaseId, setLiveCaseId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState('idle');
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { persistLocal({ doses: taken }); }, [taken]);
  useEffect(() => { persistLocal({ skipped }); }, [skipped]);
  useEffect(() => { persistLocal({ checkIns }); }, [checkIns]);

  const doses = useMemo(() => buildSchedule(prescriptions, taken, 2, Date.now(), skipped), [prescriptions, taken, skipped]);
  const checkIn = useMemo(() => pendingCheckIn(queue, checkIns), [queue, checkIns]);

  const actions = useMemo<DeviceActions>(() => ({
    addLiveCase: (c, after) => {
      setQueue(q => [c, ...q]);
      setLiveCaseId(c.id);
      setReviewStatus('pending');
      setRejectReason('');
      after?.();
    },

    setReview: (status, reason = '') => {
      setReviewStatus(status);
      setRejectReason(reason);
    },

    setLiveCaseId,

    // Nothing writes `notifications` from a client (§3.6): a locally raised
    // notice is a UI event and lives only for this session.
    pushNotice: (n) => setNotices(s => [{ at: Date.now(), ...n }, ...s]),

    // Used for "visit ended early", which has no row of its own: the server
    // records abandonment through `run_consult_timers`, not from the client.
    addConsultRecord: (c) => setConsults(s => [c, ...s]),

    // Booking has no availability table yet: the slot the patient picks is
    // written straight in as a booked appointment (patient-todo.md).
    bookSlot: (title, startsAt, location) => setAppointments(a => [...a, {
      id: `bk-${startsAt}`, patient: title, reason: title, kind: 'imaging',
      startsAt, minutes: 15, location, status: 'booked',
    }]),

    // The value is when it was recorded, so the row can say so afterwards.
    setDoseTaken: (id, t) => {
      setSkipped(sk => (sk[id] ? { ...sk, [id]: false } : sk));
      setTaken(d => ({ ...d, [id]: t ? Date.now() : false }));
    },
    setDoseSkipped: (id, sk) => {
      setTaken(d => (d[id] ? { ...d, [id]: false } : d));
      setSkipped(s => ({ ...s, [id]: sk }));
    },

    undoCheckIn: (consultId) => {
      setJustAnswered(null);
      setCheckIns(c => {
        const next = { ...c };
        delete next[consultId];
        return next;
      });
    },

    answerCheckIn: (answer, consultId) => {
      const id = consultId || checkIn?.consultId;
      if (!id) return;
      // The plan actually rated, which with several running is not necessarily
      // the one the sheet opened on.
      const rated = id === checkIn?.consultId
        ? checkIn
        : checkIn?.alternatives.find(a => a.id === id);
      setJustAnswered({ consultId: id, title: rated?.title || '', answer });
      setTimeout(() => setJustAnswered(j => (j && j.consultId === id ? null : j)), UNDO_WINDOW);
      setCheckIns(c => ({ ...c, [id]: answer }));
    },
  }), [checkIn, setQueue, setNotices, setConsults, setAppointments]);

  return {
    doses, checkIn, justAnswered, liveCaseId, reviewStatus, rejectReason,
    setLiveCaseId, setReviewStatus, setRejectReason, actions,
  };
}
