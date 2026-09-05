// Patient flow: screen routing, consult session, timers, review reactions.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import type { CaseItem, Confidence, Recommendation } from '../../../lib/core';
import { isOpenConsult } from '../../../lib/core';
import { speak } from '../../../lib/voice';
import { useClinic } from '../../../store';
import { persistLocal, restoreLocal } from '../../../lib/api';
import { MiraPanel, NavBar, type NavItem } from '../../../lib/ui';
import { seedLabs } from '../../../store/seeds';
import { useAuth } from '../../../shell/auth';
import { useConsult, type PatientProfile } from '../useConsult';
import { HomeScreen } from './HomeScreen';
import { RecordsScreen, type RecordsTab } from './RecordsScreen';
import { ProfileScreen } from './ProfileScreen';
import { RecommendationScreen } from './RecommendationScreen';
import { EmptyRecommendation } from './EmptyRecommendation';
import s from './PatientFlow.module.css';

type Screen = 'home' | 'recommendation' | 'records' | 'profile';

// Shown when the orb is tapped while a plan is already with the doctor: the
// panel always opens, and it says what can be done from here (UX-11, UX-12).
const PENDING_NOTE =
  "Your plan is with Dr. Whitfield for review — I'll let you know the moment it's back. If anything has changed since we spoke, tell me here and I'll add it to the consult.";

function statusToReview(s: string): string {
  return s === 'approved' ? 'approved' : s === 'rejected' ? 'rejected' : s === 'changes' ? 'changes' : 'pending';
}

const SCREENS: Screen[] = ['home', 'recommendation', 'records', 'profile'];
const TABS: RecordsTab[] = ['history', 'labs'];

type NavTab = 'home' | 'history' | 'labs' | 'profile';

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'history', label: 'History', icon: 'clock' },
  { key: 'labs', label: 'Labs', icon: 'drop' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

export function PatientFlow() {
  const clinic = useClinic();
  const { user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  // The URL owns the screen: /patient[/recommendation|records|profile]. The
  // consult is not a screen — it overlays whatever you are on.
  const seg = loc.pathname.split('/')[2] ?? '';
  const screen: Screen = (SCREENS.includes(seg as Screen) ? seg : 'home') as Screen;
  const tabParam = params.get('tab');
  const recordsTab: RecordsTab = (TABS.includes(tabParam as RecordsTab) ? tabParam : 'history') as RecordsTab;
  const setRecordsTab = (t: RecordsTab) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', t);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (screen !== 'records' || !tabParam || TABS.includes(tabParam as RecordsTab)) return;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'history');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tabParam]);

  const [rec, setRec] = useState<Recommendation | null>(null);
  const [miraOpen, setMiraOpen] = useState(false);

  // Mira is told exactly what the patient has on file — nothing more (UX-25).
  const hp = clinic.profile;
  const facts = useMemo(() => {
    const bits = [
      hp.age && `age ${hp.age}`,
      hp.blood && `blood group ${hp.blood}`,
      hp.allergies ? `allergic to ${hp.allergies}` : 'no allergies recorded',
    ].filter(Boolean);
    return bits.length > 1
      ? `On file: ${bits.join(', ')}. That is the whole record — do not assume anything beyond it.`
      : undefined;
  }, [hp.age, hp.blood, hp.allergies]);
  const patient: PatientProfile = { name: user?.name || 'there', facts };
  const demoLine = [hp.age, hp.blood].filter(Boolean).join(' · ');

  const consult = useConsult({
    patient,
    onDone: (r, ctx) => {
      const users = ctx.users.slice(0, 3).map(t => (t.length > 26 ? t.slice(0, 24) + '…' : t));
      const live: CaseItem = {
        id: `live-${Date.now()}`, mine: true, submittedAt: Date.now(),
        patient: patient.name, demo: demoLine || 'No demographics on file',
        title: r.title, status: 'pending_review',
        meta: navigator.onLine === false ? 'Queued — sends when you are back online' : 'Just now · live',
        summary: 'Live consult with Dr. Mira (AI). ' + (r.summary || ''),
        symptoms: users,
        history: hp.allergies ? `Allergic to ${hp.allergies}.` : 'No allergies or history on file for this patient.',
        confidence: ctx.confidence as Confidence,
        flags: ctx.flags,
        stated: ctx.notes.length ? ctx.notes : users,
        inferred: [r.title],
        observation: 'No acute distress noted during the call.',
        rec: r,
        relevantLabs: seedLabs.map(l => ({ ...l })),
        pastLabs: seedLabs.map(l => ({ ...l })),
        pastConsults: clinic.consults.map(c => ({ title: c.title, date: c.date, note: c.note })),
      };
      setRec(r);
      clinic.addLiveCase(live);
      setMiraOpen(false);
      nav('/patient/recommendation');
    },
  });

  // A consult left unfinished when the tab went away is closed out and shown in
  // History, instead of vanishing without trace (UX-15).
  const swept = useRef(false);
  useEffect(() => {
    if (swept.current) return;
    swept.current = true;
    const draft = restoreLocal()?.draftConsult;
    if (!draft || !draft.messages?.length) return;
    persistLocal({ draftConsult: null });
    clinic.addConsultRecord({
      id: `ab-${draft.at}`, title: 'Visit ended early', date: 'Today', status: 'Unfinished',
      note: 'This visit was interrupted before Dr. Mira could finish, so no plan was sent. You can start a fresh consult anytime.',
      user: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UX-03: the plan itself is persisted, only the in-memory copy was not — so
  // a reload (or a later visit) rehydrates it instead of showing "no plan yet".
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || rec) return;
    const mine = clinic.queue.find(c => c.mine);
    if (!mine) return;
    restored.current = true;
    setRec(mine.rec);
    clinic.setLiveCaseId(mine.id);
    clinic.setReview(statusToReview(mine.status), mine.rejectReason || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinic.queue, rec]);

  // Approval / rejection spoken lines when the doctor decides while rec is open.
  const prevReview = useRef(clinic.reviewStatus);
  useEffect(() => {
    const was = prevReview.current;
    prevReview.current = clinic.reviewStatus;
    // Only a decision the patient is here to witness is spoken; a restored
    // status on load is not an announcement.
    if (was !== 'pending') return;
    if (screen !== 'recommendation' || !rec) return;
    if (clinic.reviewStatus === 'approved') {
      const kind = rec.type === 'prescription' ? 'prescription' : 'plan';
      speak(`Dr. Whitfield has reviewed your ${kind}. Here it is.`);
    } else if (clinic.reviewStatus === 'rejected') {
      const kind = rec.type === 'prescription' ? 'prescription' : 'plan';
      speak(`Dr. Whitfield has reviewed your ${kind} and feels you need to be seen in person. ${clinic.rejectReason}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinic.reviewStatus]);

  // Timers: 30-min abandonment, review SLA sweep.
  useEffect(() => {
    const t = setInterval(() => {
      if (miraOpen && consult.lastTurn && Date.now() - consult.lastTurn > 30 * 60 * 1000) {
        consult.reset();
        setMiraOpen(false);
        clinic.addConsultRecord({
          id: `ab-${Date.now()}`, title: 'Visit ended early', date: 'Today', status: 'Unfinished',
          note: 'No response for 30 minutes — closed automatically. You can start a fresh consult anytime.', user: true,
        });
      }
      clinic.slaTick();
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miraOpen, consult.lastTurn]);

  // The orb (and "Ask a follow-up") always open the panel — never a silent
  // navigation and never nothing at all (UX-11, UX-12).
  const openMira = () => {
    setMiraOpen(true);
    const open = clinic.queue.find(c => c.mine && isOpenConsult(c.status));
    if (open) {
      // A plan is already with the doctor: explain the state rather than
      // starting a second consult behind the first.
      if (consult.messages.length === 0) setTimeout(() => consult.note(PENDING_NOTE), 0);
      return;
    }
    // Reopening resumes a conversation still in progress; one that already
    // produced a plan starts over, so a follow-up is a fresh consult.
    if (consult.messages.length > 0 && !rec) return;
    consult.reset();
    setRec(null);
    setTimeout(() => consult.start(), 0);
  };

  const startConsult = () => {
    const open = clinic.queue.find(c => c.mine && isOpenConsult(c.status));
    if (open) {
      setRec(open.rec);
      clinic.setLiveCaseId(open.id);
      clinic.setReview(statusToReview(open.status), open.rejectReason || '');
      nav('/patient/recommendation');
      return;
    }
    openMira();
  };

  // The nav orb is also the panel's only dismiss control now.
  const toggleMira = () => (miraOpen ? setMiraOpen(false) : openMira());

  if (seg && !SCREENS.includes(seg as Screen)) {
    return <Navigate to="/patient" replace state={{ notFound: loc.pathname }} />;
  }

  const goTab = (t: NavTab) => {
    if (t === 'home') nav('/patient');
    else if (t === 'profile') nav('/patient/profile');
    else nav(`/patient/records?tab=${t}`);
  };

  return (
    <>
      {/* The plan screen is a normal screen: it keeps the nav and the orb, so
          History, Labs, Profile and Mira stay reachable while waiting (UX-20). */}
      <NavBar
        items={NAV_ITEMS}
        active={screen === 'records' ? recordsTab : screen === 'home' || screen === 'profile' ? screen : ''}
        onSelect={k => goTab(k as NavTab)}
        orb={{ label: 'Dr. Mira', voiceState: consult.status, onClick: toggleMira }}
        railTop="profile"
      />

      <MiraPanel
        open={miraOpen}
        onClose={() => setMiraOpen(false)}
        session={consult}
        youLabel="You"
        placeholder="Type instead — e.g. fever 3 days…"
        draftKey="vd_consult_draft"
      />
      <div className={s.screen}>
        {screen === 'home' && <HomeScreen onStart={startConsult} />}
        {screen === 'recommendation' && rec && (
          <RecommendationScreen
            rec={rec}
            reviewStatus={clinic.reviewStatus}
            rejectReason={clinic.rejectReason}
            allergies={hp.allergies}
            onFollowUp={openMira}
            onBack={() => nav('/patient')}
            onViewRecords={() => { setRecordsTab('history'); nav('/patient/records'); }}
          />
        )}
        {screen === 'recommendation' && !rec && (
          <EmptyRecommendation onHome={() => nav('/patient')} />
        )}
        {screen === 'profile' && <ProfileScreen prescriptions={clinic.prescriptions} />}
        {screen === 'records' && (
          <RecordsScreen
            consults={clinic.consults}
            labs={seedLabs}
            tab={recordsTab}
            onTab={setRecordsTab}
          />
        )}
      </div>
    </>
  );
}
