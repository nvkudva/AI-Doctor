// Full case view: AI consult summary, decision actions, patient side panel.
import { useState } from 'react';
import type { CaseItem } from '../../../lib/core';
import { Button, Card, Disclosure, Icon, MenuRow, MicroLabel, Popover, StatusPill } from '../../../lib/ui';
import { useBreakpoint } from '../../../shell/viewport';
import { ink, lines, media, radius, space, tints, type, z } from '../../../lib/theme';

// Injected once by DoctorApp — the case column measure (DESIGN §10.7).
export const caseDetailCss = `
.vd-case-col{width:100%;min-width:0}
${media.tabletUp}{.vd-case-col{max-width:720px}}
${media.desktopUp}{.vd-case-col{max-width:760px}}
.vd-case-read{max-width:68ch}`;

export function CaseDetail({ ac, actionable, asideInPanel, onApprove, onDecline, onEdit }: {
  ac: CaseItem; actionable: boolean;
  /** Desktop: history + test history live in the third pane instead (D-3). */
  asideInPanel?: boolean;
  onApprove: () => void; onDecline: () => void; onEdit: () => void;
}) {
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const [menu, setMenu] = useState(false);
  const read = mobile ? type.callout : type.calloutT;
  const small = mobile ? type.footnote : type.footnoteT;
  const tests = ac.rec.items.filter(i => !(i.dosage && i.dosage.trim()));
  const rx = ac.rec.items.filter(i => !!(i.dosage && i.dosage.trim()));

  const decisions = (
    <>
      <MenuRow icon="doc" onClick={() => { setMenu(false); onEdit(); }}>Send back for changes</MenuRow>
      <MenuRow icon="x" danger onClick={() => { setMenu(false); onDecline(); }}>Decline…</MenuRow>
    </>
  );

  return (
    <div className="vd-case-col" style={{ display: 'flex', flexDirection: 'column', gap: mobile ? space[4] : bp === 'tablet' ? space[5] : space[6] }}>
      <div
        className="vd-glass-thin"
        style={{
          position: 'sticky', top: mobile ? space[2] : bp === 'tablet' ? 72 + space[4] : 76 + space[5], zIndex: z.sticky,
          padding: mobile ? `${space[3]}px ${space[4]}px` : `${space[4]}px ${space[5]}px`,
          borderRadius: mobile ? radius.md : radius.lg, border: `1px solid ${lines.glass}`,
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: space[3],
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 160px' }}>
          <div style={{ ...(mobile ? type.headline : type.headlineT), color: ink.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ac.patient}</div>
          <div style={{ ...small, color: ink.soft }}>{ac.demo} · {ac.meta}</div>
        </div>
        <StatusPill status={ac.status} />
        {actionable && !mobile && (
          <div style={{ position: 'relative', display: 'flex', gap: 2, flex: 'none' }}>
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

      <Card level={2} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: space[3], alignItems: 'center' }}>
          <MicroLabel>AI consultation</MicroLabel>
          <StatusPill status={ac.confidence} />
        </div>
        <div className="vd-case-read" style={{ ...read, color: ink.body, marginBottom: space[3] }}>{ac.summary}</div>
        <Disclosure title="What the patient said" defaultOpen={false}>
          <ul className="vd-case-read" style={{ margin: 0, paddingLeft: 18, ...read, color: ink.body }}>
            {ac.stated.map((s, i) => <li key={i}>{s}</li>)}
            {ac.flags.map((f, i) => <li key={`f${i}`}><b>Flag:</b> {f}</li>)}
          </ul>
        </Disclosure>
        <div
          className="vd-case-read"
          style={{
            background: tints.assessment.bg, border: `1px solid ${tints.assessment.bd}`,
            borderRadius: radius.sm, padding: space[4], ...read, color: ink.body,
          }}
        >
          <b>Assessment:</b> {(ac.inferred || []).join('; ') || ac.rec.title}
        </div>
        {tests.length > 0 && (
          <>
            <MicroLabel>Tests</MicroLabel>
            {tests.map((t, i) => (
              <MiniCard key={i}><b>{t.name}</b> — {t.timing}<div style={{ color: ink.secondary }}>{t.why}</div></MiniCard>
            ))}
          </>
        )}
        {rx.length > 0 && (
          <>
            <MicroLabel>Prescription</MicroLabel>
            {rx.map((t, i) => (
              <MiniCard key={i}><b>{t.name}</b> {t.dosage} — {t.timing}<div style={{ color: ink.secondary }}>{t.why}</div></MiniCard>
            ))}
          </>
        )}
        {ac.rec.advice && (
          <div className="vd-case-read" style={{ ...read, color: ink.body, marginTop: space[3] }}><b>Advice:</b> {ac.rec.advice}</div>
        )}
        {ac.reviewedBy && (
          <div style={{ ...small, color: ink.secondary, marginTop: space[3] }}>
            {ac.decision === 'approved' ? 'Approved' : ac.decision} by {ac.reviewedBy}
            {ac.editedBy ? ` · draft edited ${new Date(ac.editedAt || 0).toLocaleTimeString()}` : ''}
          </div>
        )}
        {ac.status === 'rejected' && ac.rejectReason && (
          <div style={{ ...read, color: 'var(--vd-bad-fg)', marginTop: space[3] }}><b>Not approved:</b> {ac.rejectReason}</div>
        )}
      </Card>

      {!asideInPanel && <PatientPanel ac={ac} />}

      {actionable && mobile && (
        <div
          className="vd-glass"
          style={{
            position: 'fixed', left: space[5], right: space[5], zIndex: z.sticky,
            bottom: 'calc(78px + env(safe-area-inset-bottom))',
            height: 60, borderRadius: radius['2xl'], padding: `0 ${space[4]}px`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: space[3],
          }}
        >
          <Button variant="approve" onClick={onApprove}>Approve &amp; send</Button>
          <div style={{ position: 'relative', flex: 'none' }}>
            <button
              type="button"
              onClick={() => setMenu(o => !o)}
              aria-label="More decision actions"
              aria-haspopup="menu"
              aria-expanded={menu}
              style={{
                width: 44, height: 44, borderRadius: radius.pill, cursor: 'pointer',
                background: 'transparent', border: `1px solid ${lines.glass}`, color: ink.onGlass,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
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
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const read = mobile ? type.callout : type.calloutT;
  const small = mobile ? type.footnote : type.footnoteT;
  const labs = [...(ac.relevantLabs || []), ...(ac.pastLabs || [])];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? space[4] : space[5] }}>
      <Card level={2} style={{ ...read, color: ink.body }}>
        <MicroLabel>Patient history</MicroLabel>
        {ac.history}
        <MicroLabel>Previous consultations</MicroLabel>
        {(ac.pastConsults || []).map((p, i) => (
          <div key={i} style={{ marginBottom: space[2] }}>
            <b>{p.title}</b> · {p.date}
            <div style={{ color: ink.secondary }}>{p.note}</div>
          </div>
        ))}
      </Card>
      {labs.length > 0 && (
        <Card level={2}>
          <MicroLabel>Test history</MicroLabel>
          {labs.map((l, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: space[3],
                padding: `${space[3]}px 0`, borderBottom: i < labs.length - 1 ? `1px solid ${lines.hairline}` : 'none',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ ...small, fontWeight: 600, color: ink.primary }}>{l.name}</div>
                <div style={{ ...small, color: ink.secondary }}>{l.date}</div>
              </div>
              <span style={{
                ...type.caption, padding: '4px 10px', borderRadius: radius.pill, flex: 'none',
                background: l.ok ? tints.labOk.bg : tints.labWarn.bg,
                color: l.ok ? tints.labOk.fg : tints.labWarn.fg,
              }}>
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
  const bp = useBreakpoint();
  return (
    <div style={{
      background: 'var(--vd-surface-panel)', borderRadius: radius.sm, padding: `${space[3]}px ${space[4]}px`,
      ...(bp === 'mobile' ? type.callout : type.calloutT), color: ink.body, marginBottom: space[2],
    }}>
      {children}
    </div>
  );
}
