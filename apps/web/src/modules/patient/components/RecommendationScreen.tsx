// The plan screen: review status, plan card, doctor card, timeline, actions.
// Two-column at ≥800 (plan left, doctor + timeline right); sticky action bar ≥1160.
import { useState } from 'react';
import type { Recommendation } from '../../../lib/core';
import { Button, Card, MicroLabel, MiraPresence, StatusPill } from '../../../lib/ui';
import { ink, lines, media, radius, space, surfaces, tints, type } from '../../../lib/theme';
import { useBreakpoint } from '../../../shell/viewport';

const DOT: Record<'done' | 'active' | 'todo', string> = {
  done: 'var(--vd-ok-fg)',
  active: 'var(--vd-warn-fg)',
  todo: 'var(--vd-ink-4)',
};

export function RecommendationScreen({ rec, reviewStatus, rejectReason, onFollowUp, onBack, onViewRecords }: {
  rec: Recommendation; reviewStatus: string; rejectReason: string; onFollowUp: () => void; onBack: () => void; onViewRecords?: () => void;
}) {
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
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
  const callout = mobile ? type.callout : type.calloutT;
  const kind = isRx ? tints.rx : tints.investigation;

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
      <style>{`
        ${media.tabletUp}{
          .vd-plan{max-width:980px;margin:0 auto;width:100%;padding:24px 28px 34px!important}
          .vd-plan-split{display:grid!important;grid-template-columns:minmax(0,1fr) 300px!important;gap:24px;align-items:start}
          .vd-plan-rail{position:sticky;top:24px;display:flex;flex-direction:column;gap:12px}
          .vd-plan-actions{max-width:560px;display:flex!important;flex-wrap:wrap;gap:8px;align-items:center}
          .vd-plan-actions>*{margin-top:0!important}
        }
        ${media.desktopUp}{
          .vd-plan{max-width:1320px;padding:28px 32px 34px!important}
          .vd-plan-split{grid-template-columns:minmax(0,720px) 340px!important;gap:32px;justify-content:center}
          .vd-plan-rail{top:28px}
          .vd-plan-actions{position:sticky;bottom:0;max-width:none;min-height:72px;margin-top:24px!important;padding:0 20px;z-index:6}
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Button variant="secondary" icon="chevL" onClick={onBack} style={{ height: 44, padding: `0 ${space[5]}px` }}>Home</Button>
        <div style={{ ...(mobile ? type.largeTitle : bp === 'tablet' ? type.largeTitleT : type.largeTitleD), color: ink.primary, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Your plan</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <MiraPresence size={mobile ? 70 : bp === 'tablet' ? 88 : 96} />
        <div style={{ ...(mobile ? type.headline : type.headlineT), color: ink.primary, textAlign: 'center' }}>{headline}</div>
      </div>

      <div className="vd-plan-split">
        <div style={{ minWidth: 0 }}>
          <Card pad={mobile ? 14 : 18}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <StatusPill status={reviewStatus === 'idle' ? 'pending' : reviewStatus} />
              <div style={{ ...callout, color: ink.body }}>
                {approved ? 'Your plan is confirmed and saved to your records.'
                  : rejected ? `Not approved — ${rejectReason || 'please visit in person.'}`
                  : expired ? 'No doctor picked this up in time — start a fresh consult below.'
                  : changed ? 'Dr. Whitfield is adjusting your plan — you’ll see the final version here.'
                  : 'A licensed doctor is reviewing Dr. Mira’s plan. You’ll be notified shortly.'}
              </div>
            </div>
            {pending && (
              <div style={{ marginTop: 10, ...callout, color: ink.secondary }}>
                Usual wait: under an hour. The confirmed plan appears here and in History.
              </div>
            )}
            {expired && (
              <div style={{ marginTop: 12 }}>
                <Button onClick={onFollowUp}>Start a fresh consult</Button>
              </div>
            )}
            {rejected && (
              <div style={{ marginTop: 12 }}>
                <Button onClick={() => setShowCare(s => !s)} aria-expanded={showCare}>Find in-person care</Button>
                {showCare && (
                  <div style={{ marginTop: 10, background: surfaces.panel, borderRadius: radius.sm, padding: '12px 14px', ...callout, color: ink.body }}>
                    Dr. Whitfield feels this needs hands-on examination. Please visit your hospital’s front desk or nearest clinic soon — show them this consult on your phone so they have the full picture. If symptoms worsen (breathing difficulty, chest pain, high fever), seek urgent care right away.
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card pad={mobile ? 20 : 24} style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ ...type.micro, padding: '5px 11px', borderRadius: radius.xs, background: kind.bg, color: kind.fg }}>
                {isRx ? 'Prescription' : 'Investigation'}
              </span>
              <span style={{ ...type.micro, padding: '5px 11px', borderRadius: radius.xs, background: rec.urgency === 'urgent' ? 'var(--vd-bad-bg)' : rec.urgency === 'soon' ? 'var(--vd-warn-bg)' : 'var(--vd-ok-bg)', color: rec.urgency === 'urgent' ? 'var(--vd-bad-fg)' : rec.urgency === 'soon' ? 'var(--vd-warn-fg)' : 'var(--vd-ok-fg)' }}>
                {rec.urgency === 'urgent' ? 'Urgent' : rec.urgency === 'soon' ? 'Soon' : 'Routine'}
              </span>
            </div>
            <div style={{ ...(mobile ? type.headline : type.headlineT), color: ink.primary, marginBottom: 4 }}>{rec.title}</div>
            <div style={{ ...callout, color: ink.secondary, marginBottom: 12, maxWidth: '68ch' }}>{rec.summary}</div>
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
              <div style={{ background: tints.advice.bg, borderRadius: radius.sm, padding: '12px 15px', marginTop: 4 }}>
                <div style={{ ...type.micro, letterSpacing: '.08em', color: tints.advice.fg, marginBottom: 5 }}>When to seek help</div>
                <div style={{ ...callout, color: ink.body, maxWidth: '68ch' }}>{rec.advice}</div>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: tints.safety.bg, borderRadius: radius.sm, padding: '11px 14px', marginTop: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', color: tints.safety.fg }}>
                <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M9 11.5l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ ...type.footnote, fontWeight: 600, color: tints.safety.fg }}>
                Safety checks done — your Penicillin allergy was respected and drug interactions were reviewed.
              </div>
            </div>
          </Card>

          <div className={bp === 'desktop' ? 'vd-plan-actions vd-glass-thin' : 'vd-plan-actions'} style={{ marginTop: 16 }}>
            {approved && isRx && !ordered ? (
              <Button fullWidth={mobile} onClick={() => setOrdered(true)}>Order medicine</Button>
            ) : (
              <Button fullWidth={mobile} onClick={onFollowUp}>Ask a follow-up</Button>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flex: 1, minWidth: 0 }}>
              {approved && isRx && !ordered && (
                <Button variant="tertiary" fullWidth onClick={onFollowUp}>Ask a follow-up</Button>
              )}
              {ordered && <Button variant="tertiary" fullWidth disabled onClick={() => {}} icon="check">Order placed</Button>}
              <Button variant="tertiary" fullWidth onClick={() => setShared(true)} icon={shared ? 'check' : undefined}>{shared ? 'Shared' : 'Share with a caregiver'}</Button>
              {onViewRecords && (
                <Button variant="tertiary" fullWidth onClick={onViewRecords}>Saved to History</Button>
              )}
            </div>
          </div>
        </div>

        <div className="vd-plan-rail">
          <Card tone="panel" level={0} pad={mobile ? 16 : 18} style={{ marginTop: mobile ? 16 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ position: 'relative', width: 42, height: 42, borderRadius: radius.pill, background: 'var(--vd-brand-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vd-ink-on-brand)', ...type.headline, flex: 'none' }}>
                SW
                <span style={{ position: 'absolute', bottom: -3, right: -3, width: 13, height: 13, borderRadius: '50%', background: approved ? 'var(--vd-ok-fg)' : 'var(--vd-warn-fg)', border: `2px solid ${surfaces.panel}` }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...(mobile ? type.headline : type.headlineT), color: ink.primary }}>Dr. Sara Whitfield, MD</div>
                <div style={{ ...type.footnote, color: ink.secondary, marginTop: 1 }}>General Physician · GMC-483920</div>
              </div>
            </div>
            <div style={{ ...callout, color: ink.body, marginTop: 10 }}>
              <span style={{ fontWeight: 700 }}>
                {approved ? 'Approved' : reviewStatus === 'rejected' ? 'Declined' : reviewStatus === 'changes' ? 'Adjusting your plan' : 'Reviewing'}
              </span>
              {' — '}
              {approved ? 'this is your final plan.' : reviewStatus === 'rejected' ? (rejectReason || 'this needs an in-person examination.') : 'Dr. Mira’s draft — a licensed doctor reviews everything before it becomes final.'}
            </div>
          </Card>

          <Card tone="panel" level={0} pad={mobile ? 16 : 18} style={{ marginTop: mobile ? 12 : 0 }}>
            <div style={{ ...type.micro, letterSpacing: '.08em', color: ink.secondary, marginBottom: 12 }}>What happens next</div>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, paddingBottom: 12 }}>
                <div style={{ width: 11, height: 11, borderRadius: '50%', flex: 'none', marginTop: 3, background: DOT[s.state] }} />
                <div>
                  <div style={{ ...(mobile ? type.headline : type.headlineT), color: s.state === 'todo' ? ink.secondary : ink.primary }}>{s.t}</div>
                  <div style={{ ...type.footnote, color: ink.secondary, marginTop: 1 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function PlanItem({ name, dosage, timing, notes, why, last }: { name: string; dosage: string; timing: string; notes: string; why: string; last?: boolean }) {
  return (
    <div style={{ padding: '14px 4px', borderBottom: last ? 'none' : `1px solid ${lines.hairline}` }}>
      <div style={{ ...type.headline, color: ink.primary }}>{name}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {!!dosage && <MetaChip label="Dosage" value={dosage} />}
        {!!timing && <MetaChip label="Timing" value={timing} />}
        {!!notes && <MetaChip label="Note" value={notes} />}
      </div>
      {!!why && <div style={{ ...type.footnote, color: ink.secondary, marginTop: 8 }}><b>Why:</b> {why}</div>}
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 120px', background: surfaces.panel, borderRadius: radius.sm, padding: '9px 11px' }}>
      <div style={{ ...type.micro, color: ink.secondary }}>{label}</div>
      <div style={{ ...type.footnote, fontWeight: 600, color: ink.body, marginTop: 2 }}>{value}</div>
    </div>
  );
}
