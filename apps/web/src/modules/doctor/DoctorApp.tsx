// Doctor module: review queue, case detail, patient panel, and one Mira orb
// mounted above the routes so it survives navigation (PRD MC-5).
import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { useBreakpoint } from '../../shell/viewport';
import { useAuth } from '../../shell/auth';
import { sortQueue, type CaseItem } from '../../lib/core';
import { Button, Card, EmptyState, Icon, MenuRow, MicroLabel, MiraOrb, Sheet, pressProps } from '../../lib/ui';
import { getTheme, gradients, ink, media, nav as navTone, radius, setTheme, space, surfaces, type, z } from '../../lib/theme';
import { ClinicProvider, useClinic } from '../../store';
import { seedConsults, seedQueue, seedRx } from '../../store/seeds';
import { useReview } from './useReview';
import { DeskHeader } from './components/DeskHeader';
import { QueueCard, queueCardCss } from './components/QueueCard';
import { CaseDetail, PatientPanel, caseDetailCss } from './components/CaseDetail';
import { DeclineSheet } from './components/DeclineSheet';
import { MiraFloat } from './components/MiraFloat';

type Filter = 'all' | 'pending' | 'urgent';

// One pane on mobile, queue + case at tablet, queue + case + patient panel at
// desktop (DESIGN §10.6).
const deskCss = `
.vd-desk{width:100%;padding:12px 16px calc(112px + env(safe-area-inset-bottom))}
.vd-panes{display:flex;flex-direction:column;gap:12px}
.vd-pane-side{display:none}
${media.tabletUp}{
  .vd-desk{padding:20px 28px 28px}
  .vd-panes{display:grid;grid-template-columns:320px minmax(0,1fr);gap:24px;align-items:start}
}
${media.desktopUp}{
  .vd-desk{max-width:1560px;margin:0 auto;padding:24px 40px 40px}
  .vd-panes{grid-template-columns:340px minmax(0,760px) 340px}
  .vd-pane-side{display:block}
}
${queueCardCss}
${caseDetailCss}`;

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
  const [showNotifs, setShowNotifs] = useState(false);
  const [miraOpen, setMiraOpen] = useState(false);
  const [account, setAccount] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [tab, setTab] = useState<'queue' | 'approved'>('queue');
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
  const visible = useMemo(() => queue.filter(c => {
    if (tab === 'approved') return c.status === 'approved';
    if (filter === 'pending') return c.status === 'pending' || c.status === 'pending_review';
    if (filter === 'urgent') return c.rec.urgency === 'urgent';
    return true;
  }), [queue, tab, filter]);
  const activeId = caseId && queue.some(c => c.id === caseId) ? caseId : null;
  const ac = activeId ? queue.find(c => c.id === activeId) : undefined;
  const paneCase = ac || (mobile ? undefined : visible[0]);
  const reviewCase = ac || queue[0];
  const pendingCount = queue.filter(c => c.status === 'pending' || c.status === 'pending_review').length;
  const queueLabel = tab === 'approved' ? 'Approved' : `Review queue · ${pendingCount} pending`;

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
  const isActionable = (c?: CaseItem) => !!c && (c.status === 'pending' || c.status === 'pending_review');
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

  const showQueue = !mobile || !ac;
  const showCase = !mobile || !!ac;
  const emptyQueue = (
    <EmptyState
      icon="doc"
      title={tab === 'approved' ? 'Nothing approved yet' : 'No cases in the queue'}
      body="New patient consults appear here automatically as they are submitted."
      action={<Button variant="tertiary" onClick={() => setTick(x => x + 1)}>Refresh</Button>}
    />
  );

  return (
    <>
      <DeskHeader
        tenantName={tenantName}
        pendingCount={pendingCount}
        showNotifs={showNotifs}
        onToggleNotifs={() => setShowNotifs(s => !s)}
        onCloseNotifs={() => setShowNotifs(false)}
        onSelectCase={selectCase}
        filter={bp === 'desktop' ? <QueueFilter value={filter} onChange={setFilter} /> : undefined}
      />

      <div className="vd-desk">
        <div className="vd-panes">
          {showQueue && (
            <section className="vd-pane-queue" aria-label="Review queue" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: space[3] }}>
              {mobile && <MicroLabel>{queueLabel}</MicroLabel>}
              {mobile ? (
                <>
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

      {mobile && (
        <DoctorNav
          tab={ac ? '' : tab}
          voiceState={review.status}
          onQueue={() => { setTab('queue'); backToQueue(); }}
          onApproved={() => { setTab('approved'); backToQueue(); }}
          onAlerts={() => setShowNotifs(true)}
          onMira={() => setMiraOpen(true)}
          onAccount={() => setAccount(true)}
        />
      )}
      <AccountSheet open={account} onClose={() => setAccount(false)} />
    </>
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

// The glass bottom nav below 800: Queue · Alerts · Mira FAB · Approved ·
// Account (DESIGN §10.8).
function DoctorNav({ tab, voiceState, onQueue, onAlerts, onMira, onApproved, onAccount }: {
  tab: 'queue' | 'approved' | '';
  voiceState: 'idle' | 'listening' | 'thinking' | 'speaking';
  onQueue: () => void; onAlerts: () => void; onMira: () => void; onApproved: () => void; onAccount: () => void;
}) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: z.nav, padding: '0 18px calc(16px + env(safe-area-inset-bottom))' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 352, margin: '0 auto' }}>
        <div
          className="vd-glass"
          style={{
            height: 62, borderRadius: radius['2xl'], boxShadow: 'var(--vd-glass-hi), var(--vd-elev-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${space[4]}px`,
          }}
        >
          <NavItem icon="doc" label="Queue" active={tab === 'queue'} onTap={onQueue} />
          <NavItem icon="bell" label="Alerts" active={false} onTap={onAlerts} />
          <div style={{ flex: 'none', width: 72 }} />
          <NavItem icon="check" label="Approved" active={tab === 'approved'} onTap={onApproved} />
          <NavItem icon="person" label="Account" active={false} onTap={onAccount} />
        </div>
        <div
          {...pressProps(onMira, 'Open Dr. Mira')}
          style={{
            position: 'absolute', left: '50%', top: -30, transform: 'translateX(-50%)',
            width: 62, height: 62, borderRadius: radius.pill, cursor: 'pointer', background: gradients.call,
            border: `1px solid var(--vd-glass-border)`, boxShadow: 'var(--vd-shadow-cta), var(--vd-glass-hi)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent',
          }}
        >
          <MiraOrb size={34} voiceState={voiceState} />
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onTap }: {
  icon: 'doc' | 'bell' | 'check' | 'person'; label: string; active: boolean; onTap: () => void;
}) {
  return (
    <div
      {...pressProps(onTap, label)}
      style={{
        flex: 1, minWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        cursor: 'pointer', padding: '8px 0', color: active ? navTone.active : navTone.idle,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon name={icon} size={22} />
      <div style={{ ...type.caption, fontWeight: active ? 700 : 600 }}>{label}</div>
    </div>
  );
}

// The bottom nav's account slot — the same actions as the header AccountMenu,
// in a sheet, because a popover would open off-screen from the nav bar.
function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const [theme, setThemeState] = useState(() => getTheme());
  return (
    <Sheet open={open} onClose={onClose} title="Dr. Sara Whitfield" label="Account">
      <div style={{ ...type.footnote, color: ink.secondary, marginBottom: space[3] }}>General Physician · GMC-483920</div>
      <MenuRow icon="person" onClick={() => { onClose(); nav('/patient'); }}>Patient view</MenuRow>
      <MenuRow
        icon={theme === 'light' ? 'moon' : 'sun'}
        onClick={() => {
          const next = theme === 'light' ? 'dark' : 'light';
          setTheme(next);
          setThemeState(next);
        }}
      >
        {theme === 'light' ? 'Dark mode' : 'Light mode'}
      </MenuRow>
      <MenuRow icon="x" onClick={() => { onClose(); signOut(); }}>Sign out</MenuRow>
    </Sheet>
  );
}
