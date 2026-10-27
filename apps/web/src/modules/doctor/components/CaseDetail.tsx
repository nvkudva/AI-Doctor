// Full case view: AI consult summary, decision actions, patient side panel.
import { splitPlan, type CaseItem, type SafetyFlag } from '../../../lib/core';
import { Button, Card, Disclosure, Icon, MicroLabel, StatusPill } from '../../../lib/ui';
import { tints } from '../../../lib/theme';
import s from './CaseDetail.module.css';

const DECISION_LABEL: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Declined',
  changes: 'Sent back for changes',
};

export function CaseDetail({ ac, actionable, asideInPanel, staged, onApprove, onDecline, onEdit, onEscalate }: {
  ac: CaseItem; actionable: boolean;
  /** Desktop: history + test history live in the third pane instead (D-3). */
  asideInPanel?: boolean;
  /** Mira has proposed an approval; the doctor still has to press it (UX-07). */
  staged?: boolean;
  onApprove: () => void; onDecline: () => void; onEdit: () => void;
  /** Book the patient in instead of signing the plan (§4.2 row 24). */
  onEscalate: () => void;
}) {
  const { rx, tests } = splitPlan(ac.rec.items);
  // A plan the validators blocked is not the doctor's to wave through: the
  // block has to be dealt with upstream, so the control says so instead of
  // taking the press (DESIGN-REVIEW D2).
  const blocking = ac.flags.filter(f => f.severity === 'block');

  return (
    <div className={s.col}>
      <div className={`vd-glass-thin ${s.bar}`}>
        <div className={s.who}>
          <div className={s.patient}>{ac.patient}</div>
          <div className={s.small}>{ac.demo} · {ac.meta}</div>
        </div>
        <StatusPill status={ac.status} />
      </div>

      <div className={s.split}>
      <Card level={2} className={s.card}>
        <div className={s.cardHead}>
          <span className={s.kindIcon}><Icon name="stethoscope" size={17} /></span>
          <MicroLabel>AI consultation</MicroLabel>
          <StatusPill status={ac.confidence} />
        </div>
        {/* The source above the conclusion, and open. Hiding what the patient
            reported while highlighting what the AI concluded from it trains
            the reviewer to rubber-stamp (DESIGN-REVIEW D10). */}
        <MicroLabel>What the patient reported</MicroLabel>
        {ac.stated.length > 0 ? (
          <>
            <ul className={s.said}>
              {ac.stated.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
            <Disclosure title="How Dr. Mira summarised it" defaultOpen={false}>
              <div className={s.summary}>{ac.summary}</div>
            </Disclosure>
          </>
        ) : (
          // No verbatim account on this consult: the summary is the only
          // record of what the patient said, so it is not hidden behind a
          // disclosure the doctor has to know to open.
          <div className={s.summary}>{ac.summary}</div>
        )}
        {/* Said after the plan was submitted, so the draft below was not built
            from it. Shown with the rest of the patient's own account, and open
            for the same reason: it is the one thing here the reviewer has not
            already seen. */}
        {(ac.addedAfter || []).length > 0 && (
          <>
            <MicroLabel>Added after submission</MicroLabel>
            <ul className={s.said}>
              {(ac.addedAfter || []).map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </>
        )}
        <div className={s.assessment}>
          <b>Assessment:</b> {(ac.inferred || []).join('; ') || ac.rec.title}
        </div>
        {tests.length > 0 && (
          <>
            <MicroLabel>Tests</MicroLabel>
            {tests.map((t, i) => (
              <MiniCard key={i}><b>{t.name}</b> — {t.timing}<div className={s.miniWhy}>{t.why}</div></MiniCard>
            ))}
          </>
        )}
        {rx.length > 0 && (
          <>
            <MicroLabel>Prescription</MicroLabel>
            {rx.map((t, i) => (
              <MiniCard key={i}><b>{t.name}</b> {t.dosage} — {t.timing}<div className={s.miniWhy}>{t.why}</div></MiniCard>
            ))}
          </>
        )}
        {ac.rec.advice && (
          <div className={s.advice}><b>Advice:</b> {ac.rec.advice}</div>
        )}
        {ac.reviewedBy && (
          <div className={s.audit}>
            {DECISION_LABEL[ac.decision || ''] || 'Reviewed'} by {ac.reviewedBy}
            {ac.reviewedAt ? ` · ${new Date(ac.reviewedAt).toLocaleString()}` : ''}
            {ac.editedBy ? ` · draft edited ${new Date(ac.editedAt || 0).toLocaleTimeString()}` : ''}
          </div>
        )}
        {ac.status === 'rejected' && ac.rejectReason && (
          <div className={s.declined}><b>Not approved:</b> {ac.rejectReason}</div>
        )}
      </Card>

      {!asideInPanel && <PatientPanel ac={ac} />}
      </div>

      {actionable && (
        // Last in the column on purpose: the decision sits after the tests, the
        // advice and the safety checks, not above them. It sticks to the foot
        // of the pane once it has been reached, so it stays in hand while the
        // doctor re-reads, but it cannot be pressed before the plan is passed.
        <div className={`vd-glass ${s.decide}${staged ? ' ' + s.decideStaged : ''}`}>
          {blocking.length > 0 && (
            <div className={s.blocked} role="status">
              <Icon name="alert" size={15} />
              Cannot be approved — {blocking.map(f => f.code.replace(/_/g, ' ')).join(', ')}.
            </div>
          )}
          <div className={s.decideRow}>
            <Button variant="secondary" onClick={onEdit} className={s.decideBtn}>Request changes</Button>
            <Button variant="secondary" onClick={onDecline} className={`${s.decideBtn} ${s.decideDecline}`}>
              Decline
            </Button>
            <Button
              variant="approve"
              disabled={blocking.length > 0}
              onClick={onApprove}
              className={`${s.decideBtn} ${s.decideApprove}`}
            >
              Approve &amp; send
            </Button>
          </div>
          <Button variant="tertiary" icon="clock" onClick={onEscalate} className={s.decideAlt}>
            Book an appointment instead
          </Button>
        </div>
      )}
    </div>
  );
}

// Every validator verdict on the draft, severity first. A doctor should never
// have to open a transcript to find out the AI avoided an allergy — the checks
// that ran are as much a part of the decision as the plan itself.
const VERDICT: Record<SafetyFlag['severity'], { label: string; bg: string; fg: string; icon: 'alert' | 'x' | 'check' }> = {
  block: { label: 'Blocked', bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)', icon: 'x' },
  // "Check" beside a red flag reads as either an instruction or a past
  // participle, and the two mean opposite things (D34).
  warn: { label: 'Needs review', bg: 'var(--vd-warn-bg)', fg: 'var(--vd-warn-fg)', icon: 'alert' },
  info: { label: 'Clear', bg: 'var(--vd-ok-bg)', fg: 'var(--vd-ok-fg)', icon: 'check' },
};
const RANK: Record<SafetyFlag['severity'], number> = { block: 0, warn: 1, info: 2 };

function SafetyChecks({ flags }: { flags: SafetyFlag[] }) {
  if (!flags.length) return null;
  const sorted = [...flags].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return (
    <Card level={2} className={s.safety}>
      <MicroLabel>Safety checks</MicroLabel>
      {sorted.map((f, i) => {
        const v = VERDICT[f.severity];
        return (
          <div key={`${f.code}${i}`} className={`${s.check}${i === sorted.length - 1 ? ' ' + s.checkLast : ''}`}>
            <span className={s.checkIcon} style={{ background: v.bg, color: v.fg }}>
              <Icon name={v.icon} size={14} />
            </span>
            <div className={s.checkBody}>
              <div className={s.checkHead}>
                <span className={s.checkCode}>{f.code.replace(/_/g, ' ')}</span>
                <span className="vd-tag" style={{ background: v.bg, color: v.fg }}>{v.label}</span>
              </div>
              <div className={s.checkText}>{f.text}</div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// Pane 3 at desktop, inline in the case column below it (PRD D-3).
function PatientPanel({ ac }: { ac: CaseItem }) {
  const labs = [...(ac.relevantLabs || []), ...(ac.pastLabs || [])];
  return (
    <div className={s.panel}>
      <SafetyChecks flags={ac.flags} />
      <Card level={2} className={s.history}>
        <div className={s.cardHead}>
          <span className={s.kindIcon}><Icon name="person" size={17} /></span>
          <MicroLabel>Patient history</MicroLabel>
        </div>
        {ac.history}
        <MicroLabel>Previous consultations</MicroLabel>
        {/* A heading over nothing reads as a section that failed to load. The
            absence is stated instead, because "none at this clinic" is itself
            a clinical fact the reviewer is entitled to rely on (D33). */}
        {(ac.pastConsults || []).length === 0 ? (
          <div className={s.pastNone}>No previous consultations at this clinic.</div>
        ) : (ac.pastConsults || []).map((p, i) => (
          <div key={i} className={s.past}>
            <b>{p.title}</b> · {p.date}
            <div className={s.pastNote}>{p.note}</div>
          </div>
        ))}
      </Card>
      {labs.length > 0 && (
        <Card level={2}>
          <MicroLabel>Test history</MicroLabel>
          {labs.map((l, i) => (
            <div
              key={i}
              className={`${s.lab}${i < labs.length - 1 ? '' : ' ' + s.labLast}`}
            >
              <div style={{ minWidth: 0 }}>
                <div className={s.labName}>{l.name}</div>
                <div className={s.labDate}>{l.date}</div>
              </div>
              <span
                className={`vd-tag ${s.labResult}`}
                style={{
                  background: l.ok ? tints.labOk.bg : tints.labWarn.bg,
                  color: l.ok ? tints.labOk.fg : tints.labWarn.fg,
                }}
              >
                {l.result}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function MiniCard({ children }: { children: React.ReactNode }) {
  return <div className={s.mini}>{children}</div>;
}
