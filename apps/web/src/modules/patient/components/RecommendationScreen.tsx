import { useState } from 'react';
import type { Recommendation } from '../../../lib/core';
import { Icon, MicroLabel, MiraPresence, pressProps, StatusPill } from '../../../lib/ui';
import { gradients, ink, media, surfaces, type } from '../../../lib/theme';

export function RecommendationScreen({ rec, reviewStatus, rejectReason, onFollowUp, onBack, onViewRecords }: {
  rec: Recommendation; reviewStatus: string; rejectReason: string; onFollowUp: () => void; onBack: () => void; onViewRecords?: () => void;
}) {
  const [ordered, setOrdered] = useState(false);
  const [shared, setShared] = useState(false);
  const [showCare, setShowCare] = useState(false);
  const approved = reviewStatus === 'approved';
  const pending = reviewStatus === 'pending' || reviewStatus === 'idle';
  const rejected = reviewStatus === 'rejected';
  const expired = reviewStatus === 'expired';
  const changed = reviewStatus === 'changes';
  const isRx = rec.type === 'prescription';
  const tests = rec.items.filter(i => !(i.dosage && i.dosage.trim()));
  const rx = rec.items.filter(i => !!(i.dosage && i.dosage.trim()));
  const headline = approved
    ? `Dr. Whitfield reviewed your ${isRx ? 'prescription' : 'plan'} — here it is.`
    : 'Sent to Dr. Whitfield for a quick review.';

  const steps: { t: string; d: string; state: 'done' | 'active' | 'todo' }[] = [
    { t: 'Consult complete', d: 'Dr. Mira prepared your plan', state: 'done' },
    { t: approved ? 'Reviewed by Dr. Whitfield' : 'Doctor review', d: approved ? 'Approved just now' : 'A licensed doctor is checking your plan', state: approved ? 'done' : 'active' },
    { t: 'Plan ready', d: approved ? 'Saved to your records' : 'You’ll be notified when it’s confirmed', state: approved ? 'done' : 'todo' },
    isRx
      ? { t: 'Collect medicine', d: approved ? (ordered ? 'Order placed' : 'Order for delivery or pickup') : 'Available once approved', state: approved ? (ordered ? 'done' : 'active') : 'todo' }
      : { t: 'Book your test', d: approved ? 'Choose a lab and time' : 'Available once approved', state: approved ? 'active' : 'todo' },
  ];

  return (
    <div className="vd-scroll vd-plan" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 20px 34px' }}>
      <style>{`${media.tabletUp}{.vd-plan{max-width:980px;margin:0 auto;width:100%}.vd-plan-split{display:grid!important;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}.vd-plan-actions{max-width:560px}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div {...pressProps(onBack, 'Back to home')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, height: 38, padding: '0 14px', background: surfaces.chip, borderRadius: 99, fontSize: 13, fontWeight: 600, color: ink.onGlass }}>
          <Icon name="chevL" size={16} /> Home
        </div>
        <div style={{ ...type.largeTitle, color: ink.primary, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Your plan</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <MiraPresence size={70} />
        <div style={{ ...type.headline, color: ink.primary, textAlign: 'center' }}>{headline}</div>
      </div>

      <div style={{ background: surfaces.card, borderRadius: 16, padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <StatusPill status={reviewStatus === 'idle' ? 'pending' : reviewStatus} />
          <div style={{ fontSize: 12.5, color: ink.body }}>
            {approved ? 'Your plan is confirmed and saved to your records.'
              : rejected ? `Not approved — ${rejectReason || 'please visit in person.'}`
              : expired ? 'No doctor picked this up in time — start a fresh consult below.'
              : changed ? 'Dr. Whitfield is adjusting your plan — you’ll see the final version here.'
              : 'A licensed doctor is reviewing Dr. Mira’s plan. You’ll be notified shortly.'}
          </div>
        </div>
        {pending && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: ink.secondary }}>
            Usual wait: under an hour. The confirmed plan appears here and in History.
          </div>
        )}
        {expired && (
          <div {...pressProps(onFollowUp, 'Start a fresh consult')} style={{ cursor: 'pointer', marginTop: 12, borderRadius: 99, height: 48, padding: '0 18px', display: 'inline-flex', alignItems: 'center', background: gradients.primary, fontSize: 13.5, fontWeight: 700, color: 'var(--vd-ink-on-brand)' }}>
            Start a fresh consult
          </div>
        )}
        {rejected && (
          <div style={{ marginTop: 12 }}>
            <div {...pressProps(() => setShowCare(s => !s), 'Find in-person care')} aria-expanded={showCare} style={{ cursor: 'pointer', borderRadius: 99, height: 48, padding: '0 18px', display: 'inline-flex', alignItems: 'center', background: gradients.primary, fontSize: 13.5, fontWeight: 700, color: 'var(--vd-ink-on-brand)' }}>
              Find in-person care
            </div>
            {showCare && (
              <div style={{ marginTop: 10, background: surfaces.panel, borderRadius: 12, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.55, color: ink.body }}>
                Dr. Whitfield feels this needs hands-on examination. Please visit your hospital’s front desk or nearest clinic soon — show them this consult on your phone so they have the full picture. If symptoms worsen (breathing difficulty, chest pain, high fever), seek urgent care right away.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ background: surfaces.card, borderRadius: 16, padding: 20, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ ...type.micro, padding: '5px 11px', borderRadius: 14, background: isRx ? 'oklch(0.62 0.2 300 / .14)' : 'oklch(0.6 0.14 200 / .16)', color: isRx ? 'oklch(0.45 0.19 300)' : 'oklch(0.4 0.14 220)' }}>
            {isRx ? 'Prescription' : 'Investigation'}
          </span>
          <span style={{ ...type.micro, padding: '5px 11px', borderRadius: 14, background: rec.urgency === 'urgent' ? 'var(--vd-bad-bg)' : rec.urgency === 'soon' ? 'var(--vd-warn-bg)' : 'var(--vd-ok-bg)', color: rec.urgency === 'urgent' ? 'var(--vd-bad-fg)' : rec.urgency === 'soon' ? 'var(--vd-warn-fg)' : 'var(--vd-ok-fg)' }}>
            {rec.urgency === 'urgent' ? 'Urgent' : rec.urgency === 'soon' ? 'Soon' : 'Routine'}
          </span>
        </div>
        <div style={{ ...type.headline, color: ink.primary, marginBottom: 4 }}>{rec.title}</div>
        <div style={{ fontSize: 13, color: ink.secondary, marginBottom: 12 }}>{rec.summary}</div>
        {rx.length > 0 && (
          <>
            <MicroLabel>Prescription</MicroLabel>
            {rx.map((it, i) => <PlanItem key={i} last={i === rx.length - 1} name={it.name} dosage={it.dosage} timing={it.timing} notes={it.notes} why={it.why} />)}
          </>
        )}
        {tests.length > 0 && (
          <>
            <MicroLabel>Tests</MicroLabel>
            {tests.map((it, i) => <PlanItem key={i} last={i === tests.length - 1} name={it.name} dosage={it.dosage} timing={it.timing} notes={it.notes} why={it.why} />)}
          </>
        )}
        {rec.advice && (
          <div style={{ background: 'oklch(0.7 0.13 200 / .12)', borderRadius: 14, padding: '12px 15px', marginTop: 4 }}>
            <div style={{ ...type.micro, letterSpacing: '.08em', textTransform: 'uppercase', color: 'oklch(0.45 0.12 220)', marginBottom: 5 }}>When to seek help</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: ink.body }}>{rec.advice}</div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'oklch(0.72 0.13 160 / .12)', borderRadius: 14, padding: '11px 14px', marginTop: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
            <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6l7-3z" stroke="oklch(0.45 0.13 160)" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M9 11.5l2 2 4-4" stroke="oklch(0.45 0.13 160)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: 'oklch(0.4 0.12 160)', fontWeight: 600 }}>
            Safety checks done — your Penicillin allergy was respected and drug interactions were reviewed.
          </div>
        </div>
      </div>

      <div className="vd-plan-split" style={{ display: 'contents' }}>
      <div style={{ background: surfaces.panel, border: '1px solid rgba(90,70,180,.14)', borderRadius: 16, padding: '15px 16px', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ position: 'relative', width: 42, height: 42, borderRadius: 99, background: gradients.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vd-ink-on-brand)', ...type.headline, flex: 'none' }}>
            SW
            <span style={{ position: 'absolute', bottom: -3, right: -3, width: 13, height: 13, borderRadius: '50%', background: approved ? 'oklch(0.72 0.15 160)' : 'oklch(0.8 0.15 85)', border: '2px solid #7A5AE0' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ ...type.headline, color: ink.primary }}>Dr. Sara Whitfield, MD</div>
            <div style={{ fontSize: 12, color: ink.muted, marginTop: 1 }}>General Physician · GMC-483920</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: ink.soft, marginTop: 10, lineHeight: 1.45 }}>
          <span style={{ fontWeight: 700 }}>
            {approved ? 'Approved' : reviewStatus === 'rejected' ? 'Declined' : reviewStatus === 'changes' ? 'Adjusting your plan' : 'Reviewing'}
          </span>
          {' — '}
          {approved ? 'this is your final plan.' : reviewStatus === 'rejected' ? (rejectReason || 'this needs an in-person examination.') : 'Dr. Mira’s draft — a licensed doctor reviews everything before it becomes final.'}
        </div>
      </div>

      <div style={{ background: surfaces.panel, borderRadius: 16, padding: 16, marginTop: 12 }}>
        <div style={{ ...type.micro, letterSpacing: '.08em', textTransform: 'uppercase', color: ink.muted, marginBottom: 12 }}>What happens next</div>
        {steps.map((s, i) => {
          const c = s.state === 'done' ? 'oklch(0.72 0.15 160)' : s.state === 'active' ? 'oklch(0.78 0.16 90)' : 'rgba(120,95,225,.35)';
          return (
            <div key={i} style={{ display: 'flex', gap: 11, paddingBottom: 12 }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', flex: 'none', marginTop: 3, background: c, boxShadow: `0 0 8px ${c}` }} />
              <div>
                <div style={{ ...type.headline, color: s.state === 'todo' ? ink.muted : ink.primary }}>{s.t}</div>
                <div style={{ fontSize: 12, color: ink.muted, marginTop: 1 }}>{s.d}</div>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      <div className="vd-plan-actions" style={{ marginTop: 16 }}>
        {approved && isRx && !ordered ? (
          <button onClick={() => setOrdered(true)} style={{ ...actionBtn, width: '100%' }}>Order medicine</button>
        ) : (
          <button onClick={onFollowUp} style={{ ...actionBtn, width: '100%' }}>Ask a follow-up</button>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {approved && isRx && !ordered && (
            <button onClick={onFollowUp} style={actionGhost}>Ask a follow-up</button>
          )}
          {ordered && <button onClick={() => {}} style={actionGhost}>Order placed ✓</button>}
          <button onClick={() => setShared(true)} style={actionGhost}>{shared ? 'Shared ✓' : 'Share with a caregiver'}</button>
          {onViewRecords && (
            <button onClick={onViewRecords} style={actionGhost}>Saved to History — view</button>
          )}
        </div>
      </div>
    </div>
  );
}

const actionBtn = {
  cursor: 'pointer', border: 0, borderRadius: 99, height: 48, padding: '0 12px', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: gradients.primary, color: 'var(--vd-ink-on-brand)', fontSize: 15, fontWeight: 700,
  boxShadow: 'var(--vd-shadow-cta)',
} as const;

const actionGhost = {
  cursor: 'pointer', flex: 1, border: '1px solid var(--vd-border)', borderRadius: 99, height: 48, padding: '0 8px',
  fontFamily: 'inherit', background: 'transparent', color: ink.body, fontSize: 13, fontWeight: 600,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
} as const;

function PlanItem({ name, dosage, timing, notes, why, last }: { name: string; dosage: string; timing: string; notes: string; why: string; last?: boolean }) {
  return (
    <div style={{ padding: '14px 4px', borderBottom: last ? 'none' : '1px solid var(--vd-border)' }}>
      <div style={{ ...type.headline, color: ink.primary }}>{name}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {!!dosage && <MetaChip label="Dosage" value={dosage} />}
        {!!timing && <MetaChip label="Timing" value={timing} />}
        {!!notes && <MetaChip label="Note" value={notes} />}
      </div>
      {!!why && <div style={{ fontSize: 12.5, color: ink.secondary, marginTop: 8 }}><b>Why:</b> {why}</div>}
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 120px', background: surfaces.panel, borderRadius: 12, padding: '9px 11px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: ink.muted }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: ink.body, marginTop: 2 }}>{value}</div>
    </div>
  );
}
