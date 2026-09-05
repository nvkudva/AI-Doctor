// Patient flow: screen routing, consult session, timers, review reactions.
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import type { CaseItem, Confidence, Recommendation } from '../../../lib/core';
import { isOpenConsult } from '../../../lib/core';
import { speak } from '../../../lib/voice';
import { useClinic } from '../../../store';
import { MiraPanel, NavBar, type NavItem } from '../../../lib/ui';
import { useIsMobile } from '../../../shell/viewport';
import { seedLabs } from '../../../store/seeds';
import { useConsult } from '../useConsult';
import { HomeScreen } from './HomeScreen';
import { RecordsScreen, type RecordsTab } from './RecordsScreen';
import { ProfileScreen } from './ProfileScreen';
import { RecommendationScreen } from './RecommendationScreen';
import { EmptyRecommendation } from './EmptyRecommendation';

type Screen = 'home' | 'recommendation' | 'records' | 'profile';

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
  const mobile = useIsMobile();
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

  const [rec, setRec] = useState<Recommendation | null>(null);
  const [miraOpen, setMiraOpen] = useState(false);

  const consult = useConsult({
    onDone: (r, ctx) => {
      const users = ctx.users.slice(0, 3).map(t => (t.length > 26 ? t.slice(0, 24) + '…' : t));
      const live: CaseItem = {
        id: `live-${Date.now()}`, mine: true, submittedAt: Date.now(),
        patient: 'Alex Kumar', demo: '34 · Male · O+', title: r.title, meta: 'Just now · live', status: 'pending_review',
        summary: 'Live consult with Dr. Mira (AI). ' + (r.summary || ''),
        symptoms: users, history: 'Mild asthma. Allergic to Penicillin. Blood group O+.',
        confidence: ctx.confidence as Confidence,
        flags: ctx.flags.length ? ctx.flags : ['Penicillin allergy respected'],
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
      const kind = r.type === 'prescription' ? 'prescription' : 'plan';
      setTimeout(() => speak(`Thanks, Alex. I've prepared your ${kind} and sent it to Dr. Whitfield for a quick review.`), 400);
    },
  });

  // Approval / rejection spoken lines when the doctor decides while rec is open.
  useEffect(() => {
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

  const startConsult = () => {
    // One open consult per patient: resume the one awaiting review.
    const open = clinic.queue.find(c => c.mine && isOpenConsult(c.status));
    if (open) {
      setRec(open.rec);
      clinic.setLiveCaseId(open.id);
      clinic.setReview('pending');
      nav('/patient/recommendation');
      return;
    }
    setMiraOpen(true);
    // Reopening resumes: only a fresh panel starts a new conversation.
    if (consult.messages.length > 0) return;
    consult.reset();
    setRec(null);
    setTimeout(() => consult.start(), 0);
  };

  // The nav orb is also the panel's only dismiss control now.
  const toggleMira = () => (miraOpen ? setMiraOpen(false) : startConsult());

  if (seg && !SCREENS.includes(seg as Screen)) {
    return <Navigate to="/patient" replace />;
  }

  const goTab = (t: NavTab) => {
    if (t === 'home') nav('/patient');
    else if (t === 'profile') nav('/patient/profile');
    else nav(`/patient/records?tab=${t}`);
  };

  return (
    <>
      {(!mobile || screen !== 'recommendation') && (
        <NavBar
          items={NAV_ITEMS}
          active={screen === 'records' ? recordsTab : screen === 'home' || screen === 'profile' ? screen : ''}
          onSelect={k => goTab(k as NavTab)}
          orb={{ label: 'Dr. Mira', voiceState: consult.status, onClick: toggleMira }}
          railTop="profile"
        />
      )}

      <MiraPanel
        open={miraOpen}
        onClose={() => setMiraOpen(false)}
        session={consult}
        youLabel="You"
        placeholder="Type instead — e.g. fever 3 days…"
        draftKey="vd_consult_draft"
      />
      <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {screen === 'home' && <HomeScreen onStart={startConsult} />}
        {screen === 'recommendation' && rec && (
          <RecommendationScreen
            rec={rec}
            reviewStatus={clinic.reviewStatus}
            rejectReason={clinic.rejectReason}
            onFollowUp={startConsult}
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
