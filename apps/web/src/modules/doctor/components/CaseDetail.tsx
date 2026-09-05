// Full case view: AI consult summary, history, labs, decision actions.
import { useEffect, useRef, useState } from 'react';
import type { CaseItem } from '../../../lib/core';
import { Disclosure, DismissCatcher, Icon, MicroLabel, pressProps, StatusPill } from '../../../lib/ui';
import { gradients, ink, surfaces, type, z } from '../../../lib/theme';

export function CaseDetail({ ac, actionable, mobile, onApprove, onDecline, onEdit }: {
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
