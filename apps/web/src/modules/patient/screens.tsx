import { useState } from 'react';
import type { Recommendation } from '@vd/core';
import { Icon, MicroLabel, MiraPresence, pressProps, StatusPill } from '@vd/ui';
import { gradients, ink, media, surfaces, type } from '@vd/theme';
import { useAuth } from '../../shell/auth';
import { AccountMenu } from '../../shell/account';
import type { RecordsTab } from '../../shell/routing';
import type { UserConsult, UserRx } from '../../shell/store';

function daypart(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function HomeScreen({ onStart }: { onStart: () => void }) {
  const { user } = useAuth();
  const first = (user?.name || 'Alex Kumar').replace(/^Dr\.\s*/, '').split(' ')[0] || 'there';
  return (
    <div className="vd-scroll vd-home" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 20px 118px' }}>
      <style>{`${media.tabletUp}{.vd-home{max-width:960px;margin:0 auto;width:100%}.vd-home-grid{display:flex;gap:28px;align-items:center;justify-content:center;flex:1;width:100%}.vd-home-hero{flex:1.2;min-width:0}.vd-home-side{display:flex!important}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ ...type.largeTitle, color: ink.primary, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{daypart()}, {first}</div>
        <AccountMenu name={user?.name || 'Alex Kumar'} detail={user?.email || 'alex.kumar@gmail.com'} />
      </div>
      <div className="vd-home-grid">
      <div className="vd-home-hero" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center', padding: '12px 0' }}>
        <MiraPresence size={152} />
        <div>
          <div style={{ ...type.headline, color: ink.primary }}>Dr. Mira is ready</div>
          <div style={{ ...type.body, lineHeight: 1.55, color: ink.soft, marginTop: 8, maxWidth: 270 }}>
            Start a consult and just talk — no forms.
          </div>
        </div>
        <div
          {...pressProps(onStart, 'Start consultation')}
          style={{
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 28px',
            borderRadius: 99, background: gradients.primary, color: 'var(--vd-ink-on-brand)', fontSize: 15, fontWeight: 700,
            boxShadow: 'var(--vd-shadow-cta)',
          }}
        >
          <Icon name="mic" size={19} /> Start consultation
        </div>
      </div>
      <aside className="vd-home-side" aria-label="How it works" style={{ display: 'none', flexDirection: 'column', gap: 12, flex: '1 1 280px', maxWidth: 340 }}>
        <div style={{ background: 'var(--vd-surface-card)', border: '1px solid var(--vd-glass-border)', borderRadius: 20, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--vd-ink-3)' }}>How a visit works</div>
          {['Talk with Dr. Mira — no forms', 'A doctor reviews your plan', 'Confirmed plan lands in History'].map((s, i) => (
            <div key={s} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--vd-ink-2)' }}>
              <span style={{ flex: 'none', width: 22, height: 22, borderRadius: 99, background: gradients.primary, color: 'var(--vd-ink-on-brand)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              {s}
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--vd-surface-card)', border: '1px solid var(--vd-glass-border)', borderRadius: 20, padding: '16px 18px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--vd-ink-2)' }}>
          Usual review wait is under an hour. If symptoms worsen, seek urgent care right away.
        </div>
      </aside>
      </div>
    </div>
  );
}

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

const RECORD_TABS: RecordsTab[] = ['history', 'labs', 'profile'];

export function RecordsScreen({ consults, prescriptions, labs, tab, onTab }: {
  consults: UserConsult[];
  prescriptions: UserRx[];
  labs: { name: string; date: string; result: string; ok: boolean }[];
  tab: RecordsTab;
  onTab: (t: RecordsTab) => void;
}) {
  const { user } = useAuth();
  const activeIdx = RECORD_TABS.indexOf(tab);
  return (
    <div className="vd-scroll vd-records" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 20px 118px' }}>
      <style>{`${media.tabletUp}{.vd-records{max-width:960px;margin:0 auto;width:100%}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ ...type.largeTitle, color: ink.primary, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Records</div>
        <AccountMenu name={user?.name || 'Alex Kumar'} detail={user?.email || 'alex.kumar@gmail.com'} />
      </div>
      <div role="tablist" aria-label="Records sections" style={{ position: 'relative', display: 'flex', marginBottom: 18, background: 'color-mix(in srgb, var(--vd-surface-card) 65%, transparent)', backdropFilter: 'var(--vd-glass-blur)', WebkitBackdropFilter: 'var(--vd-glass-blur)', border: '1px solid var(--vd-border)', borderRadius: 99, padding: 3 }}>
        <div
          style={{
            position: 'absolute', top: 3, bottom: 3, borderRadius: 99, background: surfaces.card,
            boxShadow: '0 3px 10px rgba(46,37,71,.18)',
            left: `calc(${activeIdx} * (100% - 6px) / 3 + 3px)`, width: 'calc((100% - 6px) / 3)',
            transition: 'left .25s var(--vd-spring)',
          }}
        />
        {RECORD_TABS.map(t => (
          <div
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => onTab(t)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTab(t);
                return;
              }
              if (e.key === 'Home') { e.preventDefault(); onTab(RECORD_TABS[0]); return; }
              if (e.key === 'End') { e.preventDefault(); onTab(RECORD_TABS[RECORD_TABS.length - 1]); return; }
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const i = RECORD_TABS.indexOf(tab);
              const n = (i + (e.key === 'ArrowRight' ? 1 : RECORD_TABS.length - 1)) % RECORD_TABS.length;
              onTab(RECORD_TABS[n]);
            }}
            tabIndex={tab === t ? 0 : -1}
            style={{
              cursor: 'pointer', flex: 1, position: 'relative', textAlign: 'center', padding: '9px 0',
              fontSize: 13, fontWeight: 700, textTransform: 'capitalize',
              color: tab === t ? ink.primary : ink.soft,
            }}
          >
            {t}
          </div>
        ))}
      </div>

      {tab === 'history' && (
        <>
          <SectionTitle>Consultation history</SectionTitle>
          <SectionSub>Your past visits with Dr. Mira · tap to view details</SectionSub>
          {consults.length === 0 && <EmptyState>Nothing here yet — your visits will appear after your first consult.</EmptyState>}
          {consults.map(c => <ConsultCard key={c.id} c={c} />)}
        </>
      )}

      {tab === 'labs' && (
        <>
          <SectionTitle>Lab tests</SectionTitle>
          <SectionSub>Results from your previous blood work &amp; tests</SectionSub>
          {labs.length === 0 && <EmptyState>No lab results yet.</EmptyState>}
          {labs.map((l, i) => <LabRow key={i} name={l.name} date={l.date} result={l.result} ok={l.ok} />)}
          <SectionTitle>Documents</SectionTitle>
          {[['Chest X-ray report.pdf', 'Mar 2026'], ['CBC results.pdf', 'Feb 2026']].map(([n, d]) => (
            <div key={n} style={{ background: surfaces.card, borderRadius: 16, padding: '13px 15px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'flex', color: ink.soft }}><Icon name="doc" size={19} /></span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: ink.primary }}>{n}</div>
                <div style={{ fontSize: 12, color: ink.secondary }}>{d}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'profile' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 99, background: gradients.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vd-ink-on-brand)', ...type.headline, flex: 'none' }}>AK</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: ink.primary }}>Alex Kumar</div>
              <div style={{ fontSize: 12.5, color: ink.soft }}>alex.kumar@gmail.com</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {[['Age', '34'], ['Blood', 'O+'], ['Allergy', 'Penicillin']].map(([k, v]) => (
              <div key={k} style={{ flex: 1, background: surfaces.card, borderRadius: 16, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: ink.muted }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: k === 'Allergy' ? 'var(--vd-bad-fg)' : ink.primary }}>{v}</div>
              </div>
            ))}
          </div>
          <SectionTitle>Prescriptions</SectionTitle>
          {prescriptions.length === 0 && <EmptyState>No prescriptions on file.</EmptyState>}
          {prescriptions.map((p, i) => (
            <div key={i} style={{ background: surfaces.card, borderRadius: 16, padding: '13px 15px', marginBottom: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: ink.primary }}>{p.name}</div>
              <div style={{ fontSize: 12, color: ink.secondary }}>{p.detail} · {p.date}</div>
            </div>
          ))}
          <SectionTitle>Coverage & payment</SectionTitle>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, borderRadius: 14, padding: 12, background: surfaces.card, border: '1px solid var(--vd-border)' }}>
              <div style={{ ...type.micro, color: ink.muted }}>Insurance</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: ink.primary, marginTop: 4 }}>Star Health · AX-48291</div>
              <div style={{ fontSize: 12, color: ink.secondary, marginTop: 2 }}>Family Floater · ₹500 copay</div>
            </div>
            <div style={{ flex: 1, borderRadius: 14, padding: 12, background: surfaces.card, border: '1px solid var(--vd-border)' }}>
              <div style={{ ...type.micro, color: ink.muted }}>Payment</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: ink.primary, marginTop: 4 }}>•••• 4291</div>
              <div style={{ fontSize: 12, color: ink.secondary, marginTop: 2 }}>HDFC · Exp 09/28</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: ink.primary, margin: '14px 4px 10px' }}>{children}</div>;
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: ink.soft, marginBottom: 12 }}>{children}</div>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div style={{ background: surfaces.card, borderRadius: 16, padding: '15px 16px', marginBottom: 10, fontSize: 13, color: ink.secondary }}>{children}</div>;
}

function ConsultCard({ c }: { c: UserConsult }) {
  const [open, setOpen] = useState(false);
  const d = c.detail;
  return (
    <div style={{ background: surfaces.card, borderRadius: 16, padding: '15px 16px', marginBottom: 10 }}>
      <div
        onClick={() => d && setOpen(o => !o)}
        role={d ? 'button' : undefined}
        tabIndex={d ? 0 : undefined}
        aria-expanded={d ? open : undefined}
        aria-label={d ? `${c.title} — details` : undefined}
        onKeyDown={e => {
          if (!d || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          setOpen(o => !o);
        }}
        style={{ cursor: d ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: ink.primary }}>{c.title}</div>
          <span style={{ flex: 'none' }}><StatusPill status={c.status === 'Approved' ? 'approved' : c.status} /></span>
        </div>
        <div style={{ fontSize: 13, color: ink.muted, marginTop: 3 }}>{c.date} · Dr. Mira</div>
        <div style={{ fontSize: 13, color: ink.secondary, marginTop: 8, lineHeight: 1.5 }}>{c.note}</div>
        {d && <div style={{ fontSize: 12, fontWeight: 700, color: ink.soft, marginTop: 6 }}>{open ? 'Show less ‹' : 'View details ›'}</div>}
      </div>
      {d && open && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--vd-border)', paddingTop: 10 }}>
          <MicroLabel>AI consultation summary</MicroLabel>
          <div style={{ fontSize: 13, color: ink.body, lineHeight: 1.5 }}>{d.summary}</div>
          <MicroLabel>Evaluation</MicroLabel>
          <div style={{ fontSize: 13, fontWeight: 600, color: ink.body }}>{d.evaluation}</div>
          {(d.tests.length > 0 || d.rx.length > 0) && <MicroLabel>Next steps</MicroLabel>}
          {d.tests.map((t, i) => <div key={i} style={miniRow}><b>{t.name}</b> · {t.detail}</div>)}
          {d.rx.map((t, i) => <div key={i} style={miniRow}><b>{t.name}</b>{t.dosage ? ` · ${t.dosage}` : ''}{t.timing ? ` · ${t.timing}` : ''}</div>)}
          <MicroLabel>Advice</MicroLabel>
          <div style={{ fontSize: 13, color: ink.body, lineHeight: 1.5 }}>{d.advice}</div>
        </div>
      )}
    </div>
  );
}

const miniRow = {
  fontSize: 12.5, color: ink.body, background: surfaces.panel,
  borderRadius: 12, padding: '8px 11px', marginBottom: 6,
} as const;

function LabRow({ name, date, result, ok }: { name: string; date: string; result: string; ok: boolean }) {
  return (
    <div style={{ background: surfaces.card, borderRadius: 16, padding: '13px 15px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: ink.primary }}>{name}</div>
        <div style={{ fontSize: 12, color: ink.secondary }}>{date}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 99, background: ok ? 'oklch(0.72 0.13 160 / .16)' : 'oklch(0.8 0.14 70 / .2)', color: ok ? 'oklch(0.45 0.13 160)' : 'oklch(0.5 0.14 60)' }}>
        {result}
      </span>
    </div>
  );
}
