// Doctor module: review queue, case detail, patient panel, and one Mira orb
// mounted above the routes so it survives navigation (PRD MC-5).
import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { useBreakpoint } from '../../shell/viewport';
import { useAuth } from '../../shell/auth';
import { isReviewable, sortQueue, type CaseItem } from '../../lib/core';
import { Button, Card, EmptyState, Icon, MenuRow, MicroLabel, NavBar, Sheet, bottomBarInset, pressProps, type NavItem } from '../../lib/ui';
import { getTheme, gradients, ink, media, radius, setTheme, space, surfaces, type } from '../../lib/theme';
import { ClinicProvider, useClinic } from '../../store';
import { seedConsults, seedQueue, seedRx } from '../../store/seeds';
import { useReview } from './useReview';
import { DeskHeader } from './components/DeskHeader';
import { QueueCard, queueCardCss } from './components/QueueCard';
import { CaseDetail, PatientPanel, caseDetailCss } from './components/CaseDetail';
import { DeclineSheet } from './components/DeclineSheet';
import { MiraFloat } from './components/MiraFloat';
import { DoctorHome, doctorHomeCss } from './components/DoctorHome';
import { ProfileScreen } from './components/ProfileScreen';

type Filter = 'all' | 'pending' | 'urgent';
type DeskTab = 'home' | 'appointments' | 'reviews';

// Home · Appointments · [Mira] · Reviews · Profile (DESIGN §10.8).
const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'appointments', label: 'Appointments', icon: 'clock' },
  { key: 'reviews', label: 'Reviews', icon: 'doc' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

// One pane on mobile, queue + case at tablet, queue + case + patient panel at
// desktop (DESIGN §10.6).
const deskCss = `
.vd-desk-shell{display:flex;width:100%;min-height:100dvh}
.vd-desk{width:100%;min-width:0;padding:12px 16px ${bottomBarInset}}
.vd-panes{display:flex;flex-direction:column;gap:12px}
.vd-pane-side{display:none}
${media.tabletUp}{
  .vd-desk-shell{gap:16px;padding:16px 0 16px 16px}
  .vd-desk{padding:20px 28px 28px}
  .vd-panes{display:grid;grid-template-columns:320px minmax(0,1fr);gap:24px;align-items:start}
}
${media.desktopUp}{
  .vd-desk-shell{gap:20px;padding:20px 0 20px 20px}
  .vd-desk{max-width:1560px;margin:0 auto;padding:24px 40px 40px}
  .vd-panes{grid-template-columns:340px minmax(0,760px) 340px}
  .vd-pane-side{display:block}
}
${queueCardCss}
${caseDetailCss}
${doctorHomeCss}`;

export function DoctorApp({ tenantName }: { tenantName: string }) {
  return (
    <ClinicProvider seedQueue={seedQueue} seedConsults={seedConsults} seedRx={seedRx}>
      <div style={{ width: '100%', minHeight: '100dvh', background: gradients.desk }}>
        <style>{deskCss}</style>
        <Routes>
          <Route path="*" element={<Desk tenantName={tenantName} />} />
        </Routes>
      </div>
    </ClinicProvider>
  );
}

function Desk({ tenantName }: { tenantName: string }) {
  const clinic = useClinic();
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const nav = useNavigate();
  // The URL owns the selection: /doctor/case/:id. One route, so nothing
  // remounts (and the Mira session survives) when it changes.
  const { pathname } = useLocation();
  const caseId = /\/case\/([^/]+)/.exec(pathname)?.[1];
  const onProfile = /\/profile\/?$/.test(pathname);
  const [showNotifs, setShowNotifs] = useState(false);
  const [miraOpen, setMiraOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [tab, setTab] = useState<DeskTab>('home');
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
  // The nav tab picks the list; the desktop filter narrows it further.
  const visible = useMemo(() => queue.filter(c => {
    if (tab === 'reviews') return isReviewable(c.status);
    if (filter === 'pending') return isReviewable(c.status);
    if (filter === 'urgent') return c.rec.urgency === 'urgent';
    return true;
  }), [queue, tab, filter]);
  const activeId = caseId && queue.some(c => c.id === caseId) ? caseId : null;
  const ac = activeId ? queue.find(c => c.id === activeId) : undefined;
  const paneCase = ac || (mobile ? undefined : visible[0]);
  const reviewCase = ac || queue[0];
  const pendingCount = queue.filter(c => isReviewable(c.status)).length;
  const queueLabel = tab === 'appointments' ? `Appointments · ${queue.length}` : `Review queue · ${pendingCount} pending`;

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
  const isActionable = (c?: CaseItem) => !!c && isReviewable(c.status);
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

  const homeTab = tab === 'home';
  const showQueue = !mobile || !ac;
  const showCase = !mobile || !!ac;
  const emptyQueue = (
    <EmptyState
      icon="doc"
      title={tab === 'reviews' ? 'Nothing to review' : 'No cases in the queue'}
      body="New patient consults appear here automatically as they are submitted."
      action={<Button variant="tertiary" onClick={() => setTick(x => x + 1)}>Refresh</Button>}
    />
  );

  return (
    <div className="vd-desk-shell">
      <NavBar
        items={NAV_ITEMS}
        active={onProfile ? 'profile' : ac ? '' : tab}
        onSelect={(k: string) => {
          if (k === 'profile') { review.stop(); nav('/doctor/profile'); return; }
          setTab(k as DeskTab);
          backToQueue();
        }}
        orb={{ label: 'Dr. Mira', voiceState: review.status, onClick: () => setMiraOpen(true) }}
        railTop="profile"
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {onProfile ? <ProfileScreen onSelectCase={selectCase} /> : <>
      <DeskHeader
        tenantName={tenantName}
        pendingCount={pendingCount}
        showNotifs={showNotifs}
        onToggleNotifs={() => setShowNotifs(s => !s)}
        onCloseNotifs={() => setShowNotifs(false)}
        onSelectCase={selectCase}
        filter={bp === 'desktop' && tab === 'appointments' ? <QueueFilter value={filter} onChange={setFilter} /> : undefined}
      />

      <div className="vd-desk">
        <div className="vd-panes">
          {showQueue && (
            <section className="vd-pane-queue" aria-label="Review queue" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: space[3] }}>
              {homeTab ? (
                <DoctorHome queue={queue} onSelect={selectCase} onSeeAll={() => setTab('appointments')} />
              ) : mobile ? (
                <>
                  <MicroLabel>{queueLabel}</MicroLabel>
                  {visible.map(c => (
                    <QueueCard key={c.id} c={c} selected={c.id === paneCase?.id} onSelect={() => selectCase(c.id)} />
                  ))}
                  {visible.length === 0 && emptyQueue}
                </>
              ) : (
                <Card tone="panel" level={1} style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
                  <MicroLabel>{queueLabel}</MicroLabel>
                  {visible.map(c => (
                    <QueueCard key={c.id} c={c} selected={c.id === paneCase?.id} onSelect={() => selectCase(c.id)} />
                  ))}
                  {visible.length === 0 && (
                    <div style={{ ...type.footnote, color: ink.soft, padding: `${space[4]}px ${space[3]}px`, textAlign: 'center' }}>
                      Nothing in this list.
                    </div>
                  )}
                </Card>
              )}
            </section>
          )}

          {showCase && (
            <section className="vd-pane-case" aria-label="Case" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: space[3] }}>
              {mobile && ac && (
                <div
                  {...pressProps(backToQueue, 'Back to review queue')}
                  className="vd-glass"
                  style={{
                    cursor: 'pointer', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: space[2],
                    minHeight: 44, padding: `0 ${space[5]}px 0 ${space[4]}px`, borderRadius: radius.pill,
                    ...type.subhead, fontWeight: 700, color: ink.onGlass,
                  }}
                >
                  <Icon name="chevL" size={16} /> Queue · {pendingCount} pending
                </div>
              )}
              {paneCase ? (
                <CaseDetail
                  ac={paneCase}
                  actionable={isActionable(paneCase)}
                  asideInPanel={bp === 'desktop'}
                  onApprove={() => approveId(paneCase.id)}
                  onDecline={() => askDecline(paneCase.id)}
                  onEdit={() => clinic.decide(paneCase.id, 'changes')}
                />
              ) : !mobile ? emptyQueue : null}
            </section>
          )}

          <aside className="vd-pane-side" aria-label="Patient" style={{ minWidth: 0, position: 'sticky', top: 96 }}>
            {paneCase && <PatientPanel ac={paneCase} />}
          </aside>
        </div>
      </div>
      </>}
      </div>

      {declineFor && (
        <DeclineSheet
          open={declining}
          reason={declineReason}
          onReason={setDeclineReason}
          onCancel={() => setDeclining(false)}
          onConfirm={confirmDecline}
        />
      )}

      <MiraFloat
        review={review}
        onEdit={paneCase ? (() => clinic.decide(paneCase.id, 'changes')) : null}
        open={miraOpen}
        onOpen={() => setMiraOpen(true)}
        onClose={() => setMiraOpen(false)}
      />

    </div>
  );
}

// All / Pending / Urgent segmented control — desktop header only (PRD D-2).
function QueueFilter({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const opts: { k: Filter; label: string }[] = [
    { k: 'all', label: 'All' }, { k: 'pending', label: 'Pending' }, { k: 'urgent', label: 'Urgent' },
  ];
  return (
    <div role="tablist" aria-label="Filter queue" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: radius.pill, background: surfaces.chip, flex: 'none' }}>
      {opts.map(o => {
        const on = o.k === value;
        return (
          <button
            key={o.k}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.k)}
            style={{
              height: 40, padding: `0 ${space[5]}px`, borderRadius: radius.pill, cursor: 'pointer',
              border: '1px solid transparent', background: on ? surfaces.raised : 'transparent',
              color: on ? ink.primary : ink.secondary, boxShadow: on ? 'var(--vd-elev-1)' : 'none',
              ...type.subheadD,
              transition: 'background var(--vd-dur-2) var(--vd-ease-spring)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
