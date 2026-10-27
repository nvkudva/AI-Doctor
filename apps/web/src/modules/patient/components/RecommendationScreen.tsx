// The plan screen: review status, plan card, doctor card, timeline, actions.
// Two-column at ≥800 (plan left, doctor + timeline right); sticky action bar ≥1160.
import { useState } from 'react';
import { persistLocal, restoreLocal } from '../../../lib/api';
import type { Recommendation } from '../../../lib/core';
import { Button, Card, Icon, MicroLabel, Paper, PaperItem, StatusPill } from '../../../lib/ui';
import { useBreakpoint } from '../../../shell/viewport';
import s from './RecommendationScreen.module.css';

const DOT: Record<'done' | 'active' | 'todo', string> = {
  done: 'var(--vd-ok-fg)',
  active: 'var(--vd-warn-fg)',
  todo: 'var(--vd-ink-4)',
};

export function RecommendationScreen({ rec, reviewStatus, rejectReason, allergies, onFollowUp, onBack, onViewRecords, onBook, bookedFor }: {
  rec: Recommendation; reviewStatus: string; rejectReason: string;
  /** What the patient's record actually lists, so the plan asserts nothing more. */
  allergies?: string;
  onFollowUp: () => void; onBack: () => void; onViewRecords?: () => void;
  /** Open the booking screen for one ordered test. Only meaningful once approved. */
  onBook?: (test: string) => void;
  /** When this test already has a slot, the line to show instead of the button. */
  bookedFor?: (test: string) => string | undefined;
}) {
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  // Persisted per plan, so "Order placed" survives a reload (QA P2).
  const [ordered, setOrdered] = useState(() => (restoreLocal()?.orders || []).includes(rec.title));
  const placeOrder = () => {
    const orders = restoreLocal()?.orders || [];
    if (!orders.includes(rec.title)) persistLocal({ orders: [...orders, rec.title] });
    setOrdered(true);
  };
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
    <div className={s.screen}>
      <div className={s.topRow}>
        <Button variant="secondary" icon="chevL" onClick={onBack} className={s.back}>Home</Button>
        <div className={s.pageTitle}>Your plan</div>
      </div>

      <div className={s.hero}>
        <div className={s.heroLine}>{headline}</div>
      </div>

      <div className={s.split}>
        <div className={s.col}>
          <Card className={s.statusCard}>
            <div className={s.statusRow}>
              <StatusPill status={reviewStatus === 'idle' ? 'pending' : reviewStatus} />
              <div className={s.statusText}>
                {approved ? 'Your plan is confirmed and saved to your records.'
                  : rejected ? `Not approved — ${rejectReason || 'please visit in person.'}`
                  : expired ? 'No doctor picked this up in time — start a fresh consult below.'
                  : changed ? 'Dr. Whitfield is adjusting your plan — you’ll see the final version here.'
                  : 'A licensed doctor is reviewing Dr. Mira’s plan. You’ll be notified shortly.'}
              </div>
            </div>
            {pending && (
              <div className={s.waitNote}>
                Usual wait: under an hour. The confirmed plan appears here and in History.
              </div>
            )}
            {expired && (
              <div className={s.ctaWrap}>
                <Button onClick={onFollowUp}>Start a fresh consult</Button>
              </div>
            )}
            {rejected && (
              <div className={s.ctaWrap}>
                <Button onClick={() => setShowCare(c => !c)} aria-expanded={showCare}>Find in-person care</Button>
                {showCare && (
                  <div className={s.careNote}>
                    Dr. Whitfield feels this needs hands-on examination. Please visit your hospital’s front desk or nearest clinic soon — show them this consult on your phone so they have the full picture. If symptoms worsen (breathing difficulty, chest pain, high fever), seek urgent care right away.
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className={s.planCard}>
            <div className={s.badges}>
              <StatusPill status={isRx ? 'prescription' : 'investigation'} />
              {/* Through the one map, so routine is the neutral default here
                  too rather than a second shade of "good" (D19). */}
              <StatusPill status={rec.urgency} />
            </div>
            <div className={s.planTitle}>{rec.title}</div>
            <div className={s.planSummary}>{rec.summary}</div>
            {rx.length > 0 && (
              <>
                {/* An unsigned draft is not a prescription. Until a doctor has
                    approved it, the doses are shown as what is *proposed* and
                    the patient is told plainly not to start them (D3). */}
                {!approved && (
                  <div className={s.notActive} role="status">
                    <b>Not yet active — do not start these medicines.</b> They become
                    your prescription only once Dr. Whitfield has approved the plan.
                  </div>
                )}
                <Paper
                  icon="pill"
                  title={approved ? 'Prescription' : 'Proposed medicines'}
                  meta={`${rx.length} item${rx.length === 1 ? '' : 's'}`}
                  className={approved ? s.pad : `${s.pad} ${s.draft}`}
                >
                  {rx.map((it, i) => (
                    <PaperItem
                      key={i}
                      icon="pill"
                      last={i === rx.length - 1}
                      name={it.name}
                      lead={[it.dosage, it.timing].filter(Boolean).join(' · ')}
                      why={it.why || it.notes}
                    />
                  ))}
                </Paper>
              </>
            )}
            {tests.length > 0 && (
              <Paper icon="flask" title="Tests ordered" meta={`${tests.length} item${tests.length === 1 ? '' : 's'}`} className={s.pad}>
                {tests.map((it, i) => (
                  <PlanItem
                    key={i}
                    last={i === tests.length - 1}
                    name={it.name}
                    dosage={it.dosage}
                    timing={it.timing}
                    notes={it.notes}
                    why={it.why}
                    booked={bookedFor?.(it.name)}
                    onBook={approved && onBook ? () => onBook(it.name) : undefined}
                  />
                ))}
              </Paper>
            )}
            {rec.advice && (
              <div className={s.adviceBox}>
                <span className={s.adviceIcon}><Icon name="alert" size={18} /></span>
                <div>
                  <div className={s.adviceLabel}>When to seek help</div>
                  <div className={s.adviceText}>{rec.advice}</div>
                </div>
              </div>
            )}
            <div className={s.safety}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={s.safetyIcon}>
                <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M9 11.5l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className={s.safetyText}>
                Prepared against your health profile
                {allergies ? ` (allergies on file: ${allergies})` : ' (no allergies on file)'}
                . A licensed doctor reviews it before it becomes final.
              </div>
            </div>
          </Card>

          <div className={bp === 'desktop' ? `${s.actions} vd-glass-thin` : s.actions}>
            {approved && isRx && !ordered ? (
              <Button fullWidth={mobile} onClick={placeOrder}>Order medicine</Button>
            ) : (
              <Button fullWidth={mobile} onClick={onFollowUp}>Ask a follow-up</Button>
            )}
            <div className={s.actionRow}>
              {approved && isRx && !ordered && (
                <Button variant="tertiary" fullWidth onClick={onFollowUp}>Ask a follow-up</Button>
              )}
              {ordered && <Button variant="tertiary" fullWidth disabled onClick={() => {}} icon="check">Order placed</Button>}
              {/* "Share with a caregiver" was removed: it only flipped its own
                  label to "Shared" and sent nothing (UX-22). */}
              {onViewRecords && (
                <Button variant="tertiary" fullWidth onClick={onViewRecords}>View in History</Button>
              )}
            </div>
          </div>
        </div>

        <div className={s.rail}>
          <Card tone="panel" level={0} className={s.sideCard}>
            <div className={s.docRow}>
              <div className={s.avatar}>
                SW
                <span className={s.presenceDot} style={{ background: approved ? 'var(--vd-ok-fg)' : 'var(--vd-warn-fg)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={s.docName}>Dr. Sara Whitfield, MD</div>
                <div className={s.docReg}>General Physician · GMC-483920</div>
              </div>
            </div>
            <div className={s.docNote}>
              <span className={s.strong}>
                {approved ? 'Approved' : reviewStatus === 'rejected' ? 'Declined' : reviewStatus === 'changes' ? 'Adjusting your plan' : 'Reviewing'}
              </span>
              {' — '}
              {approved ? 'this is your final plan.' : reviewStatus === 'rejected' ? (rejectReason || 'this needs an in-person examination.') : 'Dr. Mira’s draft — a licensed doctor reviews everything before it becomes final.'}
            </div>
          </Card>

          <Card tone="panel" level={0} className={`${s.sideCard} ${s.sideCardTight}`}>
            <div className={s.nextLabel}>What happens next</div>
            {steps.map((step, i) => (
              <div key={i} className={s.step}>
                <div className={s.stepDot} style={{ background: DOT[step.state] }} />
                <div>
                  <div className={`${s.stepTitle}${step.state === 'todo' ? ' ' + s.stepTitleTodo : ''}`}>{step.t}</div>
                  <div className={s.stepBody}>{step.d}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function PlanItem({ name, dosage, timing, notes, why, last, booked, onBook }: {
  name: string; dosage: string; timing: string; notes: string; why: string; last?: boolean;
  /** When set, the test has a slot already and the row says when. */
  booked?: string;
  /** Present only on an ordered test the patient may book right now. */
  onBook?: () => void;
}) {
  return (
    <div className={`${s.item}${last ? ' ' + s.itemLast : ''}`}>
      <div className={s.itemName}>{name}</div>
      <div className={s.itemMeta}>
        {!!dosage && <MetaChip label="Dosage" value={dosage} />}
        {!!timing && <MetaChip label="Timing" value={timing} />}
        {!!notes && <MetaChip label="Note" value={notes} />}
      </div>
      {!!why && <div className={s.why}><b>Why:</b> {why}</div>}
      {booked && <div className={s.booked}>Booked for {booked}</div>}
      {onBook && !booked && (
        <Button variant="secondary" icon="clock" onClick={onBook} className={s.book}>Book this test</Button>
      )}
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.chip}>
      <div className={s.chipLabel}>{label}</div>
      <div className={s.chipValue}>{value}</div>
    </div>
  );
}
