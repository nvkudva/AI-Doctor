// Doctor module: review queue, case detail, patient panel, and one Mira orb
// mounted above the routes so it survives navigation (PRD MC-5).
import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { useBreakpoint } from '../../shell/viewport';
import { isReviewable, sortQueue, type CaseItem } from '../../lib/core';
import { Button, Card, EmptyState, Icon, MicroLabel, MiraPanel, NavBar, pressProps, type NavItem } from '../../lib/ui';
import { ClinicProvider, useClinic } from '../../store';
import { seedConsults, seedQueue, seedRx } from '../../store/seeds';
import { useReview } from './useReview';
import { DeskHeader } from './components/DeskHeader';
import { QueueCard } from './components/QueueCard';
import { CaseDetail, PatientPanel } from './components/CaseDetail';
import { DeclineSheet } from './components/DeclineSheet';
import { DoctorHome } from './components/DoctorHome';
import { ProfileScreen } from './components/ProfileScreen';
import s from './DoctorApp.module.css';

type Filter = 'all' | 'pending' | 'urgent';
type DeskTab = 'home' | 'appointments' | 'reviews';

// Home · Appointments · [Mira] · Reviews · Profile (DESIGN §10.8).
const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'appointments', label: 'Appointments', icon: 'clock' },
  { key: 'reviews', label: 'Reviews', icon: 'doc' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

export function DoctorApp({ tenantName }: { tenantName: string }) {
  return (
    <ClinicProvider seedQueue={seedQueue} seedConsults={seedConsults} seedRx={seedRx}>
      <div className={s.ground}>
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
  // Each list is a route, so reload, Back and deep links all behave (UX-16).
  const tab: DeskTab = /\/doctor\/reviews/.test(pathname) ? 'reviews'
    : /\/doctor\/appointments/.test(pathname) ? 'appointments' : 'home';
  const tabPath = (t: DeskTab) => (t === 'home' ? '/doctor' : `/doctor/${t}`);
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
  // What was just sent, to whom — the most repeated moment in the desk (UX-24).
  const [sent, setSent] = useState<{ text: string; nextId?: string } | null>(null);
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(null), 8000);
    return () => clearTimeout(t);
  }, [sent]);

  const queue = useMemo(() => sortQueue(clinic.queue), [clinic.queue]);
  // The nav tab picks the list; the desktop filter narrows it further.
  const visible = useMemo(() => queue.filter(c => {
    if (tab === 'reviews' && !isReviewable(c.status)) return false;
    if (filter === 'pending') return isReviewable(c.status);
    if (filter === 'urgent') return c.rec.urgency === 'urgent';
    return true;
  }), [queue, tab, filter]);
  const activeId = caseId && queue.some(c => c.id === caseId) ? caseId : null;
  // A stale or mistyped id must say so, not quietly show a different patient (UX-17).
  const missingCase = !!caseId && !activeId;
  const ac = activeId ? queue.find(c => c.id === activeId) : undefined;
  // Mira is bound to exactly the case drawn in the case pane — never to a
  // different first-in-queue case the doctor cannot see (UX-09).
  const paneCase = missingCase ? undefined : ac || (mobile ? undefined : visible[0]);
  const pendingCount = queue.filter(c => isReviewable(c.status)).length;
  const filtered = visible.length !== queue.length;
  const queueLabel = tab === 'appointments'
    ? `Appointments · ${visible.length}${filtered ? ` of ${queue.length}` : ''}`
    : `Review queue · ${pendingCount} pending`;

  const review = useReview({
    getCase: () => paneCase,
    onEdit: (rec) => paneCase && clinic.updateRec(paneCase.id, rec),
  });

  const toggleMira = () => {
    if (miraOpen) { setMiraOpen(false); return; }
    setMiraOpen(true);
    if (!review.active) setTimeout(() => review.start(), 0);
  };
  const selectCase = (id: string) => {
    review.stop();
    nav(`/doctor/case/${id}`);
  };
  const backToQueue = () => {
    review.stop();
    nav(tabPath(tab));
  };
  const isActionable = (c?: CaseItem) => !!c && isReviewable(c.status);
  const announce = (id: string, text: string) => {
    const rest = queue.filter(c => c.id !== id && isReviewable(c.status));
    setSent({ text, nextId: rest[0]?.id });
  };
  const approveId = (id: string) => {
    const c = queue.find(x => x.id === id);
    review.stop();
    clinic.decide(id, 'approved');
    announce(id, `Approved and sent to ${c?.patient || 'the patient'}.`);
  };
  const confirmDecline = () => {
    if (!declineFor) return;
    review.stop();
    const c = queue.find(x => x.id === declineFor);
    clinic.decide(declineFor, 'rejected', { reason: declineReason });
    announce(declineFor, `Sent to ${c?.patient || 'the patient'}: not approved, with your reason.`);
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
  const emptyQueue = missingCase ? (
    <EmptyState
      icon="doc"
      title="This case is no longer available"
      body="The link may be out of date, or the case belongs to another clinic."
      action={<Button variant="tertiary" onClick={backToQueue}>Back to the queue</Button>}
    />
  ) : filtered && queue.length > 0 ? (
    <EmptyState
      icon="doc"
      title={filter === 'urgent' ? 'No urgent cases right now' : 'Nothing matches this filter'}
      body={`${queue.length} case${queue.length === 1 ? ' is' : 's are'} waiting under other filters.`}
      action={<Button variant="tertiary" onClick={() => setFilter('all')}>Show all</Button>}
    />
  ) : (
    <EmptyState
      icon="doc"
      title={tab === 'reviews' ? 'Nothing to review' : 'No cases in the queue'}
      body="New patient consults appear here automatically as they are submitted."
      action={<Button variant="tertiary" onClick={() => setTick(x => x + 1)}>Refresh</Button>}
    />
  );

  return (
    <div className={s.shell}>
      <NavBar
        items={NAV_ITEMS}
        active={onProfile ? 'profile' : tab}
        onSelect={(k: string) => {
          review.stop();
          nav(k === 'profile' ? '/doctor/profile' : tabPath(k as DeskTab));
        }}
        orb={{ label: 'Dr. Mira', voiceState: review.status, onClick: toggleMira }}
        railTop="profile"
      />
      <div className={s.column}>
      {onProfile ? <ProfileScreen onSelectCase={selectCase} /> : <>
      <DeskHeader
        tenantName={tenantName}
        pendingCount={pendingCount}
        showNotifs={showNotifs}
        onToggleNotifs={() => setShowNotifs(s => !s)}
        onCloseNotifs={() => setShowNotifs(false)}
        onSelectCase={selectCase}
        filter={bp === 'desktop' && tab !== 'home' ? <QueueFilter value={filter} onChange={setFilter} /> : undefined}
      />

      <div className={s.desk}>
        <div className={s.panes}>
          {showQueue && (
            <section className={s.pane} aria-label="Review queue">
              {homeTab ? (
                <DoctorHome queue={queue} onSelect={selectCase} onSeeAll={() => nav('/doctor/appointments')} />
              ) : mobile ? (
                <>
                  <QueueFilter value={filter} onChange={setFilter} />
                  <MicroLabel>{queueLabel}</MicroLabel>
                  {visible.map(c => (
                    <QueueCard key={c.id} c={c} selected={c.id === paneCase?.id} onSelect={() => selectCase(c.id)} />
                  ))}
                  {visible.length === 0 && emptyQueue}
                </>
              ) : (
                <Card tone="panel" level={1} className={s.queueCard}>
                  {bp !== 'desktop' && <QueueFilter value={filter} onChange={setFilter} />}
                  <MicroLabel>{queueLabel}</MicroLabel>
                  {visible.map(c => (
                    <QueueCard key={c.id} c={c} selected={c.id === paneCase?.id} onSelect={() => selectCase(c.id)} />
                  ))}
                  {visible.length === 0 && (
                    <div className={s.queueEmpty}>
                      {filtered && queue.length > 0 ? 'No cases match this filter.' : 'Nothing in this list.'}
                    </div>
                  )}
                </Card>
              )}
            </section>
          )}

          {showCase && (
            <section className={s.pane} aria-label="Case">
              {mobile && ac && (
                <div
                  {...pressProps(backToQueue, 'Back to review queue')}
                  className={`vd-glass ${s.back}`}
                >
                  <Icon name="chevL" size={16} /> Queue · {pendingCount} pending
                </div>
              )}
              {paneCase ? (
                <CaseDetail
                  ac={paneCase}
                  actionable={isActionable(paneCase)}
                  asideInPanel={bp === 'desktop'}
                  staged={review.approvalStaged}
                  onApprove={() => approveId(paneCase.id)}
                  onDecline={() => askDecline(paneCase.id)}
                  onEdit={() => clinic.decide(paneCase.id, 'changes')}
                />
              ) : !mobile ? emptyQueue : null}
            </section>
          )}

          <aside className={s.side} aria-label="Patient">
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

      {sent && (
        <div role="status" aria-live="polite" className={`vd-glass ${s.sent}`}>
          <span className={s.sentText}>{sent.text}</span>
          {sent.nextId && (
            <Button variant="tertiary" onClick={() => { setSent(null); selectCase(sent.nextId as string); }}>
              Next case
            </Button>
          )}
          <Button variant="tertiary" onClick={() => setSent(null)}>Dismiss</Button>
        </div>
      )}

      <MiraPanel
        open={miraOpen}
        onClose={() => setMiraOpen(false)}
        session={review}
        youLabel="You"
        placeholder="Type a command — e.g. add a CBC…"
        draftKey="vd_review_draft"
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
    <div role="tablist" aria-label="Filter queue" className={s.filter}>
      {opts.map(o => {
        const on = o.k === value;
        return (
          <button
            key={o.k}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.k)}
            className={`${s.filterTab}${on ? ' ' + s.filterTabOn : ''}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
