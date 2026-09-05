// Doctor module: queue page, case page, and a floating Mira assistant.
// Reuses the clinic store; approval is always an explicit UI action.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DismissCatcher, useDismiss } from '../../shell/account';
import { readCaseParam, writeCaseParam } from '../../shell/routing';
import { useIsMobile } from '../../shell/viewport';
import { sortQueue, type CaseItem } from '@vd/core';
import { Disclosure, Icon, MicroLabel, MiraPresence, pressProps, StatusPill } from '@vd/ui';
import { gradients, ink, surfaces, type, z } from '@vd/theme';
import { AccountMenu } from '../../shell/account';
import { ClinicProvider, useClinic } from '../../shell/store';
import { seedConsults, seedQueue, seedRx } from '../../shell/seeds';
import { useReview } from './useReview';

export function DoctorApp({ tenantName }: { tenantName: string }) {
  return (
    <ClinicProvider seedQueue={seedQueue} seedConsults={seedConsults} seedRx={seedRx}>
      <div style={{ width: '100%', minHeight: '100dvh', background: gradients.desk }}>
        <Desk tenantName={tenantName} />
      </div>
    </ClinicProvider>
  );
}

function Desk({ tenantName }: { tenantName: string }) {
  const clinic = useClinic();
  const mobile = useIsMobile();
  const [activeId, setActiveId] = useState<string | null>(() => {
    const fromUrl = readCaseParam();
    return fromUrl && clinic.queue.some(c => c.id === fromUrl) ? fromUrl : null;
  });
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
  useDismiss(() => setShowNotifs(false), showNotifs);
  useDismiss(() => setDeclining(false), declining);

  const selectCase = (id: string) => {
    review.stop();
    setActiveId(id);
    writeCaseParam(id);
  };
  const backToQueue = () => {
    review.stop();
    setActiveId(null);
    writeCaseParam(null);
  };
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
  const [declineFor, setDeclineFor] = useState<string | null>(null);

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
      <div style={{ position: 'relative', zIndex: z.header, padding: mobile ? '14px 12px 10px' : '20px 28px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...type.largeTitle, color: ink.primary, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Review</div>
          <div {...pressProps(() => setShowNotifs(s => !s), "Notifications")} aria-expanded={showNotifs} title="Notifications" style={{ cursor: 'pointer', position: 'relative', width: 44, height: 44, borderRadius: 99, background: 'var(--vd-glass-bg)', backdropFilter: 'var(--vd-glass-blur)', WebkitBackdropFilter: 'var(--vd-glass-blur)', border: '1px solid var(--vd-glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ink.onGlass, boxShadow: '0 3px 12px rgba(90,70,170,.22)', flex: 'none' }}>
            <Icon name="bell" size={19} />
            {clinic.notices.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 99, background: 'oklch(0.62 0.21 20)', color: 'var(--vd-ink-on-brand)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {clinic.notices.length}
              </span>
            )}
          </div>
          <AccountMenu
            name="Dr. Sara Whitfield"
            detail="General Physician · GMC-483920"
            extra={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 6px', padding: '8px 12px', background: 'var(--vd-ok-bg)', borderRadius: 99, fontSize: 11, fontWeight: 600, color: 'var(--vd-ok-fg)' }}>
                On duty · accepting reviews
              </div>
            )}
          />
        </div>
        <div style={{ ...type.footnote, color: ink.soft, marginTop: 2 }}>{tenantName} · {pendingCount} pending</div>
      </div>

      {showNotifs && <DismissCatcher onClose={() => setShowNotifs(false)} />}
      {showNotifs && (
        <div role="menu" aria-label="Notifications" style={{ position: mobile ? 'fixed' : 'absolute', zIndex: z.popover, top: mobile ? 70 : 64, right: mobile ? 12 : 18, left: mobile ? 12 : undefined, width: mobile ? undefined : 320, maxWidth: mobile ? undefined : 'calc(100% - 36px)', maxHeight: '60vh', overflowY: 'auto', background: surfaces.card, borderRadius: 16, padding: 12, boxShadow: '0 20px 50px rgba(12,20,60,.4)' }}>
          {clinic.notices.length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: ink.secondary }}>All caught up — no new notifications.</div>
          )}
          {clinic.notices.map((n, i) => (
            <div
              key={i}
              role="menuitem"
              tabIndex={0}
              aria-label={n.caseId ? `${n.t} — open case` : n.t}
              onClick={() => {
                if (n.caseId) selectCase(n.caseId);
                setShowNotifs(false);
                clinic.dismissNotice(i);
              }}
              onKeyDown={e => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                if (n.caseId) selectCase(n.caseId);
                setShowNotifs(false);
                clinic.dismissNotice(i);
              }}
              style={{ display: 'flex', gap: 8, padding: '8px 4px', borderBottom: '1px solid var(--vd-border)', fontSize: 13, cursor: n.caseId ? 'pointer' : 'default' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--vd-nav-active)', flex: 'none', marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <b style={{ color: ink.primary }}>{n.t}</b>
                <div style={{ color: ink.secondary, fontSize: 12 }}>{n.d}{n.at ? ` · ${relAge(n.at)}` : ''}</div>
              </div>
              <span
                role="button"
                tabIndex={0}
                aria-label="Dismiss notification"
                onClick={e => { e.stopPropagation(); clinic.dismissNotice(i); }}
                onKeyDown={e => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  e.stopPropagation();
                  clinic.dismissNotice(i);
                }}
                style={{ cursor: 'pointer', color: ink.muted, fontSize: 16, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
              >
                ×
              </span>
            </div>
          ))}
        </div>
      )}

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
        <div role="dialog" aria-modal="true" aria-label="Not approving this case" style={{ position: 'fixed', inset: 0, zIndex: z.popover, background: 'rgba(23,19,51,.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 18 }}>
          <div style={{ width: 'min(480px,100%)', background: surfaces.card, borderRadius: 20, padding: 20, animation: 'vd-slidein .25s ease both' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: ink.primary }}>Not approving this case?</div>
            <div style={{ fontSize: 13, color: ink.secondary, marginTop: 4 }}>The patient will see your reason, written kindly, with a next step.</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {(['Needs in-person exam', 'Missing information', 'Wrong specialty — reroute'] as const).map(chip => (
                <div
                  key={chip}
                  {...pressProps(() => setDeclineReason(chip === 'Needs in-person exam'
                    ? 'Needs an in-person examination — please show this consult at the hospital front desk.'
                    : chip === 'Missing information'
                      ? 'We need a bit more information — please start a fresh consult and describe the symptoms in detail.'
                      : 'This needs a different specialty — please show this consult at the hospital front desk for rerouting.'), chip)}
                  style={{ cursor: 'pointer', background: surfaces.chip, borderRadius: 99, padding: '10px 13px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: ink.body }}
                >
                  {chip}
                </div>
              ))}
            </div>
            <textarea
              value={declineReason}
              aria-label="Reason shown to the patient"
              onChange={e => setDeclineReason(e.target.value)}
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, border: '1px solid var(--vd-border)', borderRadius: 16, padding: '10px 12px', fontSize: 16, fontFamily: 'inherit', color: ink.body, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button autoFocus onClick={() => setDeclining(false)} style={sheetSecondary}>Cancel</button>
              <button onClick={confirmDecline} style={sheetDanger}>Don’t approve</button>
            </div>
          </div>
        </div>
      )}

      <MiraFloat review={review} onEdit={miraCase ? (() => clinic.decide(miraCase.id, 'changes')) : null} mobile={mobile} />
    </div>
  );
}

function MiraFloat({ review, onEdit, mobile }: { review: ReturnType<typeof useReview>; onEdit: (() => void) | null; mobile: boolean }) {
  const [open, setOpen] = useState(false);
  useDismiss(() => setOpen(false), open);
  return (
    <>
      {!open && (
      <div
        {...pressProps(() => setOpen(true), 'Open Dr. Mira')}
        aria-expanded={open}
        title="Dr. Mira"
        style={{
          cursor: 'pointer', position: 'fixed', zIndex: z.popover, right: mobile ? 12 : 20, bottom: mobile ? 12 : 20,
          width: 60, height: 60, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(28,24,55,.85)', backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: '1px solid rgba(255,255,255,.2)', boxShadow: '0 12px 32px rgba(20,12,60,.5), 0 0 24px oklch(0.72 0.2 300 / .45)',
        }}
      >
        <MiraPresence voiceState={review.status} size={38} />
        {review.active && (
          <span style={{ position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 99, background: 'oklch(0.72 0.2 145)', border: '2px solid rgba(28,24,55,.9)' }} />
        )}
      </div>
      )}
      {open && (
        <div role="dialog" aria-label="Dr. Mira chat" style={{ position: 'fixed', zIndex: z.popover, right: mobile ? 12 : 20, bottom: mobile ? 80 : 88, width: 'min(380px, calc(100vw - 24px))', height: 'min(600px, calc(100dvh - 170px))', display: 'flex', flexDirection: 'column', borderRadius: 22, overflow: 'hidden', background: 'rgba(28,24,55,.9)', backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)', border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 24px 60px rgba(12,8,40,.55)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px 10px 16px', borderBottom: '1px solid rgba(255,255,255,.12)', flex: 'none' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', flex: 1 }}>Dr. Mira</div>
            <div {...pressProps(() => setOpen(false), 'Close chat')} style={{ cursor: 'pointer', width: 44, height: 44, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.85)', fontSize: 18 }}>×</div>
          </div>
          <div className="vd-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
            <ReviewPanel review={review} onEdit={onEdit} mobile={mobile} />
          </div>
        </div>
      )}
    </>
  );
}

const sheetSecondary = {
  cursor: 'pointer', flex: 1, border: '1px solid var(--vd-border)', height: 48, borderRadius: 99,
  background: 'transparent', fontSize: 14, fontWeight: 700, color: ink.body, fontFamily: 'inherit',
} as const;

const sheetDanger = {
  cursor: 'pointer', flex: 1, border: 0, height: 48, borderRadius: 99,
  background: gradients.danger, fontSize: 14, fontWeight: 700, color: 'var(--vd-ink-on-brand)', fontFamily: 'inherit',
} as const;

function relAge(at: number): string {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function waitMinutes(submittedAt: number): number {
  return Math.max(0, Math.round((Date.now() - submittedAt) / 60000));
}

function waitTone(submittedAt: number): string {
  const m = waitMinutes(submittedAt);
  return m > 120 ? 'var(--vd-bad-fg)' : m > 30 ? 'var(--vd-warn-fg)' : 'var(--vd-ink-4)';
}

function waitAge(submittedAt: number): string {
  const m = Math.max(1, Math.round((Date.now() - submittedAt) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

function QueueCard({ c, selected, onSelect }: { c: CaseItem; selected?: boolean; onSelect: () => void }) {
  return (
    <div
      {...pressProps(onSelect, `Review ${c.patient} — ${c.title}`)}
      style={{
        cursor: 'pointer', padding: '13px 14px', borderRadius: 16,
        border: `1.5px solid ${selected ? 'oklch(0.6 0.2 290 / .7)' : 'transparent'}`,
        background: selected ? surfaces.card : 'color-mix(in srgb, var(--vd-surface-card) 60%, transparent)',
        boxShadow: selected ? '0 10px 24px rgba(12,20,60,.28)' : '0 3px 10px rgba(12,20,60,.14)',
      }}
    >
      <div style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>{c.patient}</div>
      <div style={{ fontSize: 12, color: ink.secondary }}>{c.title}</div>
      {(c.inferred?.[0] || c.summary) && (
        <div style={{ fontSize: 12, color: ink.secondary, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.inferred?.[0] || c.summary}
        </div>
      )}
      <div style={{ fontSize: 11, color: ink.muted, marginTop: 2 }}>
        {c.meta}{c.submittedAt ? (
          <> · waiting <b style={{ color: waitTone(c.submittedAt) }}>{waitAge(c.submittedAt)}</b></>
        ) : ''}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span title={`AI confidence: ${c.confidence}`} style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: c.confidence === 'high' ? 'var(--vd-ok-fg)' : c.confidence === 'medium' ? 'var(--vd-warn-fg)' : 'var(--vd-bad-fg)' }} />
        <StatusPill status={c.status} />
        {c.rec.urgency === 'urgent' && (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 99, background: 'var(--vd-bad-bg)', color: 'var(--vd-bad-fg)', boxShadow: '0 0 10px var(--vd-bad-bg)' }}>
            Urgent
          </span>
        )}
        {c.rec.urgency === 'soon' && (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 99, background: 'var(--vd-warn-bg)', color: 'var(--vd-warn-fg)' }}>
            Soon
          </span>
        )}
      </div>
    </div>
  );
}

function CaseDetail({ ac, actionable, mobile, onApprove, onDecline, onEdit }: {
  ac: CaseItem; actionable: boolean; mobile: boolean;
  onApprove: () => void; onDecline: () => void; onEdit: () => void;
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const chevRef = useRef<HTMLButtonElement>(null);
  const tests = ac.rec.items.filter(i => !(i.dosage && i.dosage.trim()));
  const rx = ac.rec.items.filter(i => !!(i.dosage && i.dosage.trim()));

  useEffect(() => {
    if (!menuPos) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuPos(null);
    };
    const dismiss = () => setMenuPos(null);
    window.addEventListener('keydown', close);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [menuPos]);

  const toggleMenu = () => {
    if (menuPos) {
      setMenuPos(null);
      return;
    }
    const r = chevRef.current?.getBoundingClientRect();
    const pad = 8;
    const menuW = Math.min(220, window.innerWidth - 32);
    setMenuPos({
      top: Math.max(pad, Math.min((r?.bottom || 60) + 6, window.innerHeight - pad - 96)),
      right: Math.max(pad, Math.min(window.innerWidth - (r?.right || 200), window.innerWidth - pad - menuW)),
    });
  };
  return (
    <div style={{ width: '100%', minWidth: 0, borderRadius: 20, background: 'color-mix(in srgb, var(--vd-surface-card) 45%, transparent)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: z.sticky, padding: mobile ? '10px 12px' : '12px 16px', background: 'var(--vd-desk-scrim)', backdropFilter: 'blur(18px) saturate(160%)', WebkitBackdropFilter: 'blur(18px) saturate(160%)', borderBottom: '1px solid var(--vd-border)', borderRadius: '20px 20px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...type.headline, color: ink.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ac.patient}</div>
            <div style={{ ...type.caption, fontWeight: 400, color: ink.soft }}>{ac.demo} · {ac.meta}</div>
          </div>
          <span style={{ flex: 1 }} />
          <StatusPill status={ac.status} />
          {actionable && (
            <div style={{ display: 'flex', flex: 'none', whiteSpace: 'nowrap' }}>
              <button onClick={onApprove} style={{ ...approveBtn, borderRadius: '24px 0 0 24px' }}>Approve & send</button>
              <button
                ref={chevRef}
                onClick={toggleMenu}
                aria-label="More decision actions"
                aria-haspopup="menu"
                aria-expanded={menuPos !== null}
                style={{ ...approveBtn, borderRadius: '0 24px 24px 0', padding: 0, width: 48, borderLeft: '1px solid rgba(6,35,26,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="chevD" size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: mobile ? 'nowrap' : 'wrap', flexDirection: mobile ? 'column' : 'row', gap: 12, padding: mobile ? 12 : 14 }}>
        <div style={mobile ? { flex: 'none', width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 } : { flex: '8 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: surfaces.card, borderRadius: 16, padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <MicroLabel>AI consultation</MicroLabel>
              <StatusPill status={ac.confidence} />
            </div>
            <div style={{ fontSize: 12.5, color: ink.body, marginBottom: 8 }}>{ac.summary}</div>
            <Disclosure title="What the patient said" defaultOpen={false}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: ink.body }}>
                {ac.stated.map((s, i) => <li key={i}>{s}</li>)}
                {ac.flags.map((f, i) => <li key={`f${i}`}><b>Flag:</b> {f}</li>)}
              </ul>
            </Disclosure>
            <div style={{ background: 'oklch(0.62 0.2 290 / .08)', border: '1px solid oklch(0.62 0.2 290 / .18)', borderRadius: 12, padding: 10, fontSize: 12.5, color: ink.body }}>
              <b>Assessment:</b> {(ac.inferred || []).join('; ') || ac.rec.title}
            </div>
            {tests.length > 0 && (
              <>
                <MicroLabel>Tests</MicroLabel>
                {tests.map((t, i) => <div key={i} style={miniCard}><b>{t.name}</b> — {t.timing}<div style={{ color: ink.secondary }}>{t.why}</div></div>)}
              </>
            )}
            {rx.length > 0 && (
              <>
                <MicroLabel>Prescription</MicroLabel>
                {rx.map((t, i) => <div key={i} style={miniCard}><b>{t.name}</b> {t.dosage} — {t.timing}<div style={{ color: ink.secondary }}>{t.why}</div></div>)}
              </>
            )}
            {ac.rec.advice && <div style={{ fontSize: 12.5, color: ink.body, marginTop: 8 }}><b>Advice:</b> {ac.rec.advice}</div>}
            {ac.reviewedBy && (
              <div style={{ fontSize: 12, color: ink.secondary, marginTop: 8 }}>
                {ac.decision === 'approved' ? 'Approved' : ac.decision} by {ac.reviewedBy}
                {ac.editedBy ? ` · draft edited ${new Date(ac.editedAt || 0).toLocaleTimeString()}` : ''}
              </div>
            )}
            {ac.status === 'rejected' && ac.rejectReason && (
              <div style={{ fontSize: 12.5, color: 'var(--vd-bad-fg)', marginTop: 8 }}><b>Not approved:</b> {ac.rejectReason}</div>
            )}
          </div>

          <div style={{ background: surfaces.card, borderRadius: 16, padding: 14, fontSize: 12.5, color: ink.body }}>
            <MicroLabel>Patient history</MicroLabel>
            {ac.history}
            <MicroLabel>Previous consultations</MicroLabel>
            {(ac.pastConsults || []).map((p, i) => <div key={i} style={{ marginBottom: 6 }}><b>{p.title}</b> · {p.date}<div style={{ color: ink.secondary }}>{p.note}</div></div>)}
          </div>

          {((ac.relevantLabs || []).length > 0 || (ac.pastLabs || []).length > 0) && (
            <div style={{ background: 'color-mix(in srgb, var(--vd-surface-card) 90%, transparent)', borderRadius: 14, padding: '16px 17px' }}>
              <MicroLabel>Test history</MicroLabel>
              {[...(ac.relevantLabs || []), ...(ac.pastLabs || [])].map((l, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--vd-border)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: ink.primary }}>{l.name}</div>
                    <div style={{ fontSize: 11, color: ink.secondary }}>{l.date}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: l.ok ? 'oklch(0.72 0.13 160 / .16)' : 'oklch(0.8 0.14 70 / .25)', color: l.ok ? 'oklch(0.42 0.13 160)' : 'oklch(0.45 0.14 60)' }}>
                    {l.result}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      {menuPos && <DismissCatcher onClose={() => setMenuPos(null)} />}
      {menuPos && (
        <div role="menu" aria-label="Decision actions" style={{ position: 'fixed', zIndex: z.toast, top: menuPos.top, right: menuPos.right, width: 'min(220px, calc(100vw - 32px))', maxHeight: '50vh', overflowY: 'auto', background: surfaces.card, border: '1px solid var(--vd-border)', borderRadius: 16, padding: 6, boxShadow: '0 20px 50px rgba(12,20,60,.35)' }}>
          <div role="menuitem" tabIndex={0} onClick={() => { setMenuPos(null); onEdit(); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuPos(null); onEdit(); } }} style={decisionItem}>Send back for changes</div>
          <div role="menuitem" tabIndex={0} onClick={() => { setMenuPos(null); onDecline(); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuPos(null); onDecline(); } }} style={{ ...decisionItem, color: 'var(--vd-bad-fg)' }}>Decline…</div>
        </div>
      )}
    </div>
  );
}

const decisionItem = {
  cursor: 'pointer', borderRadius: 12, minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 14, fontWeight: 600, color: ink.body,
} as const;

const approveBtn = {
  cursor: 'pointer', border: 0, minHeight: 44, padding: '0 14px', borderRadius: 99,
  background: gradients.approve,
  color: '#06231A', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
} as const;

const miniCard = {
  background: surfaces.panel, borderRadius: 12, padding: '8px 10px', fontSize: 12.5, color: ink.body, marginBottom: 6,
} as const;

function ReviewPanel({ review, onEdit, mobile }: { review: ReturnType<typeof useReview>; onEdit: (() => void) | null; mobile: boolean }) {
  const [input, setInput] = useState('');
  const send = () => {
    if (!input.trim()) return;
    review.command(input);
    setInput('');
  };
  return (
    <div style={mobile ? { flex: 'none', width: '100%', minWidth: 0, borderRadius: 22, background: 'rgba(28,24,55,.78)', backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)', border: '1px solid rgba(255,255,255,.14)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' } : { flex: '1 1 280px', minWidth: 0, alignSelf: 'flex-start', position: 'sticky', top: 12, borderRadius: 22, background: 'rgba(28,24,55,.78)', backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)', border: '1px solid rgba(255,255,255,.14)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <MiraPresence voiceState={review.status} size={mobile ? 72 : 92} onTap={review.orbTap} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', textAlign: 'center' }}>Dr. Mira</div>
      <div style={{ fontSize: 13, color: 'var(--vd-ink-on-brand)', minHeight: 40 }}>{review.line || 'Start the review and I’ll walk you through this case — change the tests, prescription, or advice by voice or text, or approve to send it to the patient.'}</div>
      <div className="vd-scroll" style={{ maxHeight: 320, overflowY: 'auto', fontSize: 12.5, color: 'var(--vd-ink-on-brand)' }}>
        {review.notes.map((n, i) => (
          <div key={i} style={{ marginBottom: 6 }}><b>{n.who}:</b> {n.t}</div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>Voice edits update the draft — nothing is sent until you approve.</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['Approve it', 'Add CBC', 'Change advice'].map(c => (
          <div key={c} {...pressProps(() => review.command(c), c)} style={{ cursor: 'pointer', background: 'rgba(255,255,255,.85)', borderRadius: 99, padding: '10px 13px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: '#3A2E5C' }}>
            {c}
          </div>
        ))}
        {review.failedCmd && (
          <div onClick={() => review.command(review.failedCmd!)} style={{ cursor: 'pointer', background: 'var(--vd-bad-bg)', borderRadius: 99, padding: '10px 13px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: 'var(--vd-bad-fg)' }}>
            Retry last command
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          aria-label="Type to Mira"
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type to Mira…"
          style={{ flex: 1, border: 0, borderRadius: 99, height: 44, padding: '0 16px', fontSize: 16 }}
        />
        <button onClick={send} aria-label="Send to Mira" style={{ cursor: 'pointer', border: 0, width: 44, height: 44, borderRadius: 99, background: 'rgba(255,255,255,.9)', color: '#241B45', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}><Icon name="send" size={18} /></button>
      </div>
      <button onClick={review.active ? review.stop : review.start} style={{ cursor: 'pointer', border: 0, height: 48, borderRadius: 99, background: 'rgba(255,255,255,.92)', fontSize: 15, fontWeight: 700, color: '#241B45', fontFamily: 'inherit' }}>
        {review.active ? 'End review' : 'Talk'}
      </button>
      {onEdit && (
        <button onClick={onEdit} style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,.5)', height: 48, borderRadius: 99, background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--vd-ink-on-brand)', fontFamily: 'inherit' }}>
          Send back for changes
        </button>
      )}
    </div>
  );
}
