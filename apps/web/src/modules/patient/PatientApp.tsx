// Patient module: login → home → consult → recommendation → profile.
// Owns the consult session; shares lifecycle + records via the clinic store.
import { useEffect, useState } from 'react';
import type { CaseItem, Confidence, Recommendation } from '@vd/core';
import { isOpenConsult } from '@vd/core';
import { speak } from '@vd/voice';
import { pressProps } from '@vd/ui';
import { gradients, media } from '@vd/theme';
import { ClinicProvider, useClinic } from '../../shell/store';
import { seedConsults, seedLabs, seedQueue, seedRx } from '../../shell/seeds';
import { useConsult } from './useConsult';
import { ConsultView } from './ConsultView';
import { HomeScreen, RecordsScreen, RecommendationScreen } from './screens';
import { BottomNav, type NavTab } from './nav';
import { readPatientRoute, writePatientRoute, type PatientScreen, type RecordsTab } from '../../shell/routing';

type Screen = PatientScreen;

export function PatientApp() {
  return (
    <ClinicProvider seedQueue={seedQueue} seedConsults={seedConsults} seedRx={seedRx}>
      <div style={{ minHeight: '100dvh', background: gradients.app, display: 'flex', justifyContent: 'center' }}>
        <style>{`${media.tabletUp}{.vd-patient-shell{width:min(1120px,100%)!important}}`}</style>
        <div className="vd-patient-shell" style={{ position: 'relative', width: 'min(560px, 100%)', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PatientFlow />
        </div>
      </div>
    </ClinicProvider>
  );
}

function PatientFlow() {
  const clinic = useClinic();
  const [route] = useState(() => readPatientRoute());
  const [screen, setScreen] = useState<Screen>(route.screen);
  const [recordsTab, setRecordsTab] = useState<RecordsTab>(route.tab);
  const [rec, setRec] = useState<Recommendation | null>(null);

  useEffect(() => {
    writePatientRoute(screen, recordsTab);
  }, [screen, recordsTab]);

  // Browser back/forward restores the visible screen.
  useEffect(() => {
    const onPop = () => {
      const r = readPatientRoute();
      setScreen(r.screen);
      setRecordsTab(r.tab);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
      setScreen('recommendation');
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
      if (screen === 'consult') {
        if (consult.lastTurn && Date.now() - consult.lastTurn > 30 * 60 * 1000) {
          consult.reset();
          clinic.addConsultRecord({
            id: `ab-${Date.now()}`, title: 'Visit ended early', date: 'Today', status: 'Unfinished',
            note: 'No response for 30 minutes — closed automatically. You can start a fresh consult anytime.', user: true,
          });
          setScreen('home');
        }
      }
      clinic.slaTick();
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, consult.lastTurn]);

  const startConsult = () => {
    // One open consult per patient: resume the one awaiting review.
    const open = clinic.queue.find(c => c.mine && isOpenConsult(c.status));
    if (open) {
      setRec(open.rec);
      clinic.setLiveCaseId(open.id);
      clinic.setReview('pending');
      setScreen('recommendation');
      return;
    }
    consult.reset();
    setRec(null);
    setScreen('consult');
    setTimeout(() => consult.start(), 0);
  };

  const endVisit = () => {
    if (consult.messages.length > 1 && !rec) {
      clinic.addConsultRecord({
        id: `ab-${Date.now()}`, title: 'Visit ended early', date: 'Today', status: 'Unfinished',
        note: 'Ended before a plan was prepared. Start a fresh consult anytime.', user: true,
      });
    }
    consult.reset();
    setScreen('home');
  };

  return (
    <>
      {screen === 'home' && <HomeScreen onStart={startConsult} />}
      {screen === 'consult' && <ConsultView consult={consult} onEnd={endVisit} />}
      {screen === 'recommendation' && rec && (
        <RecommendationScreen
          rec={rec}
          reviewStatus={clinic.reviewStatus}
          rejectReason={clinic.rejectReason}
          onFollowUp={() => setScreen('consult')}
          onBack={() => setScreen('home')}
          onViewRecords={() => { setRecordsTab('history'); setScreen('records'); }}
        />
      )}
      {screen === 'recommendation' && !rec && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 26, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--vd-ink-1)' }}>No plan to show yet</div>
          <div style={{ fontSize: 13.5, color: 'var(--vd-ink-3)' }}>Finish a consult and your plan will appear here.</div>
          <div {...pressProps(() => setScreen('home'), 'Back home')} style={{ cursor: 'pointer', borderRadius: 99, height: 48, padding: '0 24px', display: 'inline-flex', alignItems: 'center', background: 'var(--vd-surface-card)', fontSize: 13.5, fontWeight: 700, color: 'var(--vd-ink-2)' }}>
            Back home
          </div>
        </div>
      )}
      {screen === 'records' && (
        <RecordsScreen
          consults={clinic.consults}
          prescriptions={clinic.prescriptions}
          labs={seedLabs}
          tab={recordsTab}
          onTab={setRecordsTab}
        />
      )}
      {(screen === 'home' || screen === 'records') && (
        <BottomNav
          active={screen === 'home' ? 'home' : recordsTab === 'profile' ? 'profile' : recordsTab}
          onTab={(t: NavTab) => {
            if (t === 'home') setScreen('home');
            else {
              setRecordsTab(t);
              setScreen('records');
            }
          }}
          onCall={startConsult}
        />
      )}
    </>
  );
}
