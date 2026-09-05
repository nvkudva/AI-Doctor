// Full case view: AI consult summary, decision actions, patient side panel.
import { useState } from 'react';
import type { CaseItem } from '../../../lib/core';
import { Button, Card, Disclosure, Icon, MenuRow, MicroLabel, Popover, StatusPill } from '../../../lib/ui';
import { useBreakpoint } from '../../../shell/viewport';
import { tints } from '../../../lib/theme';
import s from './CaseDetail.module.css';

const DECISION_LABEL: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Declined',
  changes: 'Sent back for changes',
};

export function CaseDetail({ ac, actionable, asideInPanel, staged, onApprove, onDecline, onEdit }: {
  ac: CaseItem; actionable: boolean;
  /** Desktop: history + test history live in the third pane instead (D-3). */
  asideInPanel?: boolean;
  /** Mira has proposed an approval; the doctor still has to press it (UX-07). */
  staged?: boolean;
  onApprove: () => void; onDecline: () => void; onEdit: () => void;
}) {
  const mobile = useBreakpoint() === 'mobile';
  const [menu, setMenu] = useState(false);
  const tests = ac.rec.items.filter(i => !(i.dosage && i.dosage.trim()));
  const rx = ac.rec.items.filter(i => !!(i.dosage && i.dosage.trim()));

  const decisions = (
    <>
      <MenuRow icon="doc" onClick={() => { setMenu(false); onEdit(); }}>Send back for changes</MenuRow>
      <MenuRow icon="x" danger onClick={() => { setMenu(false); onDecline(); }}>Decline…</MenuRow>
    </>
  );

  return (
    <div className={s.col}>
      <div className={`vd-glass-thin ${s.bar}`}>
        <div className={s.who}>
          <div className={s.patient}>{ac.patient}</div>
          <div className={s.small}>{ac.demo} · {ac.meta}</div>
        </div>
        <StatusPill status={ac.status} />
        {actionable && !mobile && (
          <div className={`${s.decide}${staged ? ' ' + s.decideStaged : ''}`}>
            <Button variant="approve" half="left" onClick={onApprove}>Approve &amp; send</Button>
            <Button
              variant="approve"
              half="right"
              icon="chevD"
              width={36}
              onClick={() => setMenu(o => !o)}
              aria-label="More decision actions"
              aria-haspopup="menu"
              aria-expanded={menu}
            />
            <Popover open={menu} onClose={() => setMenu(false)} label="Decision actions" align="right" top={56} width={240}>
              {decisions}
            </Popover>
          </div>
        )}
      </div>

      <Card level={2} className={s.card}>
        <div className={s.cardHead}>
          <MicroLabel>AI consultation</MicroLabel>
          <StatusPill status={ac.confidence} />
        </div>
        <div className={s.summary}>{ac.summary}</div>
        <Disclosure title="What the patient said" defaultOpen={false}>
          <ul className={s.said}>
            {ac.stated.map((line, i) => <li key={i}>{line}</li>)}
            {ac.flags.map((f, i) => <li key={`f${i}`}><b>Flag:</b> {f}</li>)}
          </ul>
        </Disclosure>
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

      {actionable && mobile && (
        <div className={`vd-glass ${s.dock}${staged ? ' ' + s.decideStaged : ''}`}>
          <Button variant="approve" onClick={onApprove}>Approve &amp; send</Button>
          <div className={s.dockMenu}>
            <button
              type="button"
              onClick={() => setMenu(o => !o)}
              aria-label="More decision actions"
              aria-haspopup="menu"
              aria-expanded={menu}
              className={s.dockMore}
            >
              <Icon name="chevD" size={20} />
            </button>
            <Popover
              open={menu}
              onClose={() => setMenu(false)}
              label="Decision actions"
              align="right"
              width={240}
              style={{ top: 'auto', bottom: 52 }}
            >
              {decisions}
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
}

// Pane 3 at desktop, inline in the case column below it (PRD D-3).
export function PatientPanel({ ac }: { ac: CaseItem }) {
  const labs = [...(ac.relevantLabs || []), ...(ac.pastLabs || [])];
  return (
    <div className={s.panel}>
      <Card level={2} className={s.history}>
        <MicroLabel>Patient history</MicroLabel>
        {ac.history}
        <MicroLabel>Previous consultations</MicroLabel>
        {(ac.pastConsults || []).map((p, i) => (
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
