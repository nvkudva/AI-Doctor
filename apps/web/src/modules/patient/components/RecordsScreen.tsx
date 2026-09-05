import { useState } from 'react';
import { AccountMenu, Icon, MicroLabel, StatusPill } from '../../../lib/ui';
import { gradients, ink, media, surfaces, type } from '../../../lib/theme';
import { useAuth } from '../../../shell/auth';
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
