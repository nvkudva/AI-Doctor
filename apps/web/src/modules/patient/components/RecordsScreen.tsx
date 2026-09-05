// Records: history · labs · profile, behind a segmented control.
// Columns widen at ≥800 / ≥1160 (DESIGN §10.5); lab results use tint pairs.
import { useState } from 'react';
import { AccountMenu, AppHeader, Card, EmptyState, Icon, MicroLabel, StatusPill } from '../../../lib/ui';
import { gradients, ink, lines, media, radius, surfaces, tints, type } from '../../../lib/theme';
import { useAuth } from '../../../shell/auth';
import { useBreakpoint } from '../../../shell/viewport';
import type { UserConsult, UserRx } from '../../../store';

export type RecordsTab = 'history' | 'labs' | 'profile';

const RECORD_TABS: RecordsTab[] = ['history', 'labs', 'profile'];

export function RecordsScreen({ consults, prescriptions, labs, tab, onTab }: {
  consults: UserConsult[];
  prescriptions: UserRx[];
  labs: { name: string; date: string; result: string; ok: boolean }[];
  tab: RecordsTab;
  onTab: (t: RecordsTab) => void;
}) {
  const { user } = useAuth();
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const activeIdx = RECORD_TABS.indexOf(tab);
  return (
    <div className="vd-scroll vd-records" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 20px 118px' }}>
      <style>{`
        ${media.tabletUp}{
          .vd-records{max-width:860px;margin:0 auto;width:100%;padding:20px 28px 40px!important}
          .vd-records-seg{max-width:420px}
          .vd-records-list{max-width:720px}
          .vd-records-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
          .vd-records-grid>*{margin-bottom:0!important}
          .vd-records-stats{max-width:560px}
          .vd-records-cover{max-width:720px}
        }
        ${media.desktopUp}{
          .vd-records{max-width:1180px;padding:24px 32px 40px!important}
          .vd-records-list{max-width:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:24px;align-items:start}
          .vd-records-list>*{margin-bottom:0!important}
          .vd-records-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
          .vd-records-stats{max-width:640px}
        }
      `}</style>

      <AppHeader
        title="Records"
        sticky={false}
        actions={mobile ? <AccountMenu name={user?.name || 'Alex Kumar'} detail={user?.email || 'alex.kumar@gmail.com'} /> : undefined}
        style={{ marginBottom: 14 }}
      />

      <div
        role="tablist"
        aria-label="Records sections"
        className="vd-records-seg"
        style={{ position: 'relative', display: 'flex', marginBottom: 18, height: mobile || bp === 'tablet' ? 44 : 40, background: surfaces.panel, border: `1px solid ${lines.hairline}`, borderRadius: radius.pill, padding: 3 }}
      >
        <div
          style={{
            position: 'absolute', top: 3, bottom: 3, borderRadius: radius.pill, background: surfaces.raised,
            boxShadow: 'var(--vd-elev-1)',
            left: `calc(${activeIdx} * (100% - 6px) / 3 + 3px)`, width: 'calc((100% - 6px) / 3)',
            transition: 'left var(--vd-dur-3) var(--vd-ease-spring)',
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
              cursor: 'pointer', flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...(mobile ? type.subhead : type.subheadT), fontWeight: 700, textTransform: 'capitalize',
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
          {consults.length === 0
            ? <EmptyState icon="clock" title="No visits yet" body="Your visits will appear here after your first consult." />
            : <div className="vd-records-list">{consults.map(c => <ConsultCard key={c.id} c={c} />)}</div>}
        </>
      )}

      {tab === 'labs' && (
        <>
          <SectionTitle>Lab tests</SectionTitle>
          <SectionSub>Results from your previous blood work &amp; tests</SectionSub>
          {labs.length === 0
            ? <EmptyState icon="drop" title="No lab results yet" body="Results ordered through a consult land here." />
            : <div className="vd-records-grid">{labs.map((l, i) => <LabRow key={i} name={l.name} date={l.date} result={l.result} ok={l.ok} />)}</div>}
          <SectionTitle>Documents</SectionTitle>
          <div className="vd-records-grid">
            {[['Chest X-ray report.pdf', 'Mar 2026'], ['CBC results.pdf', 'Feb 2026']].map(([n, d]) => (
              <Card key={n} level={1} pad="13px 15px" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'flex', color: ink.soft }}><Icon name="doc" size={19} /></span>
                <div>
                  <div style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>{n}</div>
                  <div style={{ ...type.footnote, color: ink.secondary }}>{d}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === 'profile' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: radius.pill, background: gradients.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vd-ink-on-brand)', ...type.headline, flex: 'none' }}>AK</div>
            <div>
              <div style={{ ...(mobile ? type.title : type.titleT), color: ink.primary }}>Alex Kumar</div>
              <div style={{ ...type.footnote, color: ink.soft }}>alex.kumar@gmail.com</div>
            </div>
          </div>
          <div className="vd-records-stats" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {[['Age', '34'], ['Blood', 'O+'], ['Allergy', 'Penicillin']].map(([k, v]) => (
              <Card key={k} level={1} pad={12} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ ...type.micro, color: ink.secondary }}>{k}</div>
                <div style={{ ...type.callout, fontWeight: 700, color: k === 'Allergy' ? 'var(--vd-bad-fg)' : ink.primary }}>{v}</div>
              </Card>
            ))}
          </div>
          <SectionTitle>Prescriptions</SectionTitle>
          {prescriptions.length === 0
            ? <EmptyState icon="doc" title="No prescriptions on file" body="Approved prescriptions are saved here." />
            : (
              <div className="vd-records-list">
                {prescriptions.map((p, i) => (
                  <Card key={i} level={1} pad="13px 15px" style={{ marginBottom: 8 }}>
                    <div style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>{p.name}</div>
                    <div style={{ ...type.footnote, color: ink.secondary }}>{p.detail} · {p.date}</div>
                  </Card>
                ))}
              </div>
            )}
          <SectionTitle>Coverage &amp; payment</SectionTitle>
          <div className="vd-records-cover" style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <Card level={1} pad={12} style={{ flex: 1 }}>
              <div style={{ ...type.micro, color: ink.secondary }}>Insurance</div>
              <div style={{ ...type.callout, fontWeight: 700, color: ink.primary, marginTop: 4 }}>Star Health · AX-48291</div>
              <div style={{ ...type.footnote, color: ink.secondary, marginTop: 2 }}>Family Floater · ₹500 copay</div>
            </Card>
            <Card level={1} pad={12} style={{ flex: 1 }}>
              <div style={{ ...type.micro, color: ink.secondary }}>Payment</div>
              <div style={{ ...type.callout, fontWeight: 700, color: ink.primary, marginTop: 4 }}>•••• 4291</div>
              <div style={{ ...type.footnote, color: ink.secondary, marginTop: 2 }}>HDFC · Exp 09/28</div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ ...type.subhead, fontWeight: 700, color: ink.primary, margin: '14px 4px 10px' }}>{children}</div>;
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return <div style={{ ...type.footnote, color: ink.soft, marginBottom: 12 }}>{children}</div>;
}

function ConsultCard({ c }: { c: UserConsult }) {
  const [open, setOpen] = useState(false);
  const d = c.detail;
  return (
    <Card pad="15px 16px" style={{ marginBottom: 10 }}>
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
          <div style={{ ...type.headline, fontWeight: 600, color: ink.primary }}>{c.title}</div>
          <span style={{ flex: 'none' }}><StatusPill status={c.status === 'Approved' ? 'approved' : c.status} /></span>
        </div>
        <div style={{ ...type.subhead, fontWeight: 400, color: ink.secondary, marginTop: 3 }}>{c.date} · Dr. Mira</div>
        <div style={{ ...type.callout, color: ink.secondary, marginTop: 8 }}>{c.note}</div>
        {d && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 44, ...type.footnote, fontWeight: 700, color: ink.soft, marginTop: 6 }}>
            {open ? 'Show less' : 'View details'}
            <span style={{ display: 'inline-flex', transition: 'transform var(--vd-dur-3) var(--vd-ease-spring)', transform: open ? 'rotate(180deg)' : 'none' }}>
              <Icon name="chevD" size={14} />
            </span>
          </div>
        )}
      </div>
      {d && open && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${lines.hairline}`, paddingTop: 10 }}>
          <MicroLabel>AI consultation summary</MicroLabel>
          <div style={{ ...type.callout, color: ink.body }}>{d.summary}</div>
          <MicroLabel>Evaluation</MicroLabel>
          <div style={{ ...type.callout, fontWeight: 600, color: ink.body }}>{d.evaluation}</div>
          {(d.tests.length > 0 || d.rx.length > 0) && <MicroLabel>Next steps</MicroLabel>}
          {d.tests.map((t, i) => <div key={i} style={miniRow}><b>{t.name}</b> · {t.detail}</div>)}
          {d.rx.map((t, i) => <div key={i} style={miniRow}><b>{t.name}</b>{t.dosage ? ` · ${t.dosage}` : ''}{t.timing ? ` · ${t.timing}` : ''}</div>)}
          <MicroLabel>Advice</MicroLabel>
          <div style={{ ...type.callout, color: ink.body }}>{d.advice}</div>
        </div>
      )}
    </Card>
  );
}

const miniRow = {
  ...type.footnote, color: ink.body, background: surfaces.panel,
  borderRadius: radius.sm, padding: '8px 11px', marginBottom: 6,
} as const;

function LabRow({ name, date, result, ok }: { name: string; date: string; result: string; ok: boolean }) {
  const t = ok ? tints.labOk : tints.labWarn;
  return (
    <Card level={1} pad="13px 15px" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>{name}</div>
        <div style={{ ...type.footnote, color: ink.secondary }}>{date}</div>
      </div>
      <span style={{ ...type.caption, fontWeight: 700, padding: '5px 11px', borderRadius: radius.pill, background: t.bg, color: t.fg, flex: 'none' }}>
        {result}
      </span>
    </Card>
  );
}
