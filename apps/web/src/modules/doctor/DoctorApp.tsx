// Doctor module: queue page, case page, and a floating Mira assistant.
// Reuses the clinic store; approval is always an explicit UI action.
import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router';
import { useIsMobile } from '../../shell/viewport';
import { sortQueue, type CaseItem } from '../../lib/core';
import { pressProps } from '../../lib/ui';
import { gradients, ink, type } from '../../lib/theme';
import { ClinicProvider, useClinic } from '../../store';
import { seedConsults, seedQueue, seedRx } from '../../store/seeds';
import { useReview } from './useReview';
import { DeskHeader } from './components/DeskHeader';
import { QueueCard } from './components/QueueCard';
import { CaseDetail } from './components/CaseDetail';
import { DeclineSheet } from './components/DeclineSheet';
import { MiraFloat } from './components/MiraFloat';

export function DoctorApp({ tenantName }: { tenantName: string }) {
  return (
    <ClinicProvider seedQueue={seedQueue} seedConsults={seedConsults} seedRx={seedRx}>
      <div style={{ width: '100%', minHeight: '100dvh', background: gradients.desk }}>
        <Routes>
          <Route path="/" element={<Desk tenantName={tenantName} />} />
          <Route path="/case/:caseId" element={<Desk tenantName={tenantName} />} />
        </Routes>
      </div>
    </ClinicProvider>
  );
}

function Desk({ tenantName }: { tenantName: string }) {
  const clinic = useClinic();
  const mobile = useIsMobile();
  const { caseId } = useParams();
  const nav = useNavigate();
  // The URL owns the selection: /doctor/case/:id.
  const activeId = caseId && clinic.queue.some(c => c.id === caseId) ? caseId : null;
  const [showNotifs, setShowNotifs] = useState(false);
  // Refresh wait-time labels every minute.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState(
    'Needs an in-person examination — please show this consult at the hospital front desk.',
  );
  const [declineFor, setDeclineFor] = useState<string | null>(null);

  const queue = useMemo(() => sortQueue(clinic.queue), [clinic.queue]);
  const ac = activeId ? queue.find(c => c.id === activeId) : undefined;
  const desktopAc = ac || queue[0];
  const miraCase = ac || desktopAc;
  const reviewCase = ac || queue[0];
  const pendingCount = queue.filter(c => c.status === 'pending' || c.status === 'pending_review').length;

  const review = useReview({
    getCase: () => reviewCase,
    onEdit: (rec) => ac && clinic.updateRec(ac.id, rec),
    onApprove: () => ac && clinic.decide(ac.id, 'approved'),
  });

  const selectCase = (id: string) => {
    review.stop();
    nav(`/doctor/case/${id}`);
  };
  const backToQueue = () => {
    review.stop();
    nav('/doctor');
  };

  if (queue.length === 0) {
    return (
      <div style={{ width: '100%', borderRadius: 22, background: gradients.desk, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: ink.primary }}>No cases in the queue</div>
        <div style={{ fontSize: 13, color: ink.secondary, marginTop: 6 }}>New patient consults appear here automatically as they are submitted.</div>
      </div>
    );
  }
  const isActionable = (c?: CaseItem) => !!c && (c.status === 'pending' || c.status === 'pending_review');
  const actionable = isActionable(ac);

  const approveId = (id: string) => {
    review.stop();
    clinic.decide(id, 'approved');
  };
  const confirmDecline = () => {
    if (!declineFor) return;
    review.stop();
    clinic.decide(declineFor, 'rejected', { reason: declineReason });
    setDeclining(false);
    setDeclineFor(null);
  };
  const askDecline = (id: string) => {
    setDeclineFor(id);
    setDeclining(true);
  };

  return (
    <div style={{ width: '100%', maxWidth: '100vw', overflowX: 'clip' }}>
      <DeskHeader
        tenantName={tenantName}
        pendingCount={pendingCount}
        mobile={mobile}
        showNotifs={showNotifs}
        onToggleNotifs={() => setShowNotifs(s => !s)}
        onCloseNotifs={() => setShowNotifs(false)}
        onSelectCase={selectCase}
      />

      {!mobile ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '4px 28px 18px' }}>
          <div style={{ flex: '1 1 250px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...type.micro, letterSpacing: '.07em', textTransform: 'uppercase', color: ink.soft, margin: '2px 4px 0' }}>Review queue</div>
            {queue.map(c => (
              <QueueCard key={c.id} c={c} selected={c.id === ac?.id} onSelect={() => selectCase(c.id)} />
            ))}
          </div>
          <div style={{ flex: '3 1 460px', minWidth: 0 }}>
            {desktopAc && (
              <CaseDetail ac={desktopAc} actionable={isActionable(desktopAc)} mobile={false} onApprove={() => approveId(desktopAc.id)} onDecline={() => askDecline(desktopAc.id)} onEdit={() => clinic.decide(desktopAc.id, 'changes')} />
            )}
          </div>
        </div>
      ) : !ac ? (
        <div style={{ padding: mobile ? '4px 12px 90px' : '4px 18px 90px' }}>
          <div style={{ ...type.micro, letterSpacing: '.07em', textTransform: 'uppercase', color: ink.soft, margin: '2px 4px 10px' }}>Review queue · {pendingCount} pending</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 10 }}>
            {queue.map(c => (
              <QueueCard key={c.id} c={c} onSelect={() => selectCase(c.id)} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: mobile ? '4px 12px 90px' : '4px 18px 90px' }}>
          <div
            {...pressProps(backToQueue, 'Back to review queue')}
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 16px 0 12px', marginBottom: 10, borderRadius: 99, background: 'var(--vd-glass-bg)', backdropFilter: 'var(--vd-glass-blur)', WebkitBackdropFilter: 'var(--vd-glass-blur)', border: '1px solid var(--vd-glass-border)', fontSize: 14, fontWeight: 700, color: ink.onGlass }}
          >
            <span aria-hidden="true">‹</span> Queue · {pendingCount} pending
          </div>
          <CaseDetail ac={ac} actionable={actionable} mobile={mobile} onApprove={() => approveId(ac.id)} onDecline={() => askDecline(ac.id)} onEdit={() => clinic.decide(ac.id, 'changes')} />
        </div>
      )}

      {declining && declineFor && (
        <DeclineSheet
          reason={declineReason}
          onReason={setDeclineReason}
          onCancel={() => setDeclining(false)}
          onConfirm={confirmDecline}
        />
      )}

      <MiraFloat review={review} onEdit={miraCase ? (() => clinic.decide(miraCase.id, 'changes')) : null} mobile={mobile} />
    </div>
  );
}
