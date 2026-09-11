// Records: history · labs · profile, behind a segmented control.
// Columns widen at ≥800 / ≥1160 (DESIGN §10.5); lab results use tint pairs.
import { useState } from 'react';
import { AppHeader, Card, EmptyState, Icon, MicroLabel, StatusPill, ThemeToggle } from '../../../lib/ui';
import type { LabPanel } from '../../../store/labs';
import { PatientNotify } from './PatientNotify';
import { tints } from '../../../lib/theme';
import type { UserConsult } from '../../../store';
import s from './RecordsScreen.module.css';

export type RecordsTab = 'history' | 'labs';

const RECORD_TABS: RecordsTab[] = ['history', 'labs'];

export function RecordsScreen({ consults, panels, onPanel, tab, onTab }: {
  consults: UserConsult[];
  panels: LabPanel[];
  onPanel: (panel: string) => void;
  tab: RecordsTab;
  onTab: (t: RecordsTab) => void;
}) {
  const activeIdx = RECORD_TABS.indexOf(tab);
  return (
    <div className={s.screen}>
      <AppHeader
        title="Records"

        actions={<><ThemeToggle /><PatientNotify /></>}
        className={s.header}
      />

      <div
        role="tablist"
        aria-label="Records sections"
        className={s.seg}
      >
        <div className={s.thumb} style={{ left: `calc(${activeIdx} * (100% - 6px) / 2 + 3px)` }} />
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
            className={`${s.tab}${tab === t ? ' ' + s.tabOn : ''}`}
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
            : <div className={s.list}>{consults.map(c => <ConsultCard key={c.id} c={c} />)}</div>}
        </>
      )}

      {tab === 'labs' && (
        <>
          <SectionTitle>Lab tests</SectionTitle>
          <SectionSub>Results from your previous blood work &amp; tests</SectionSub>
          {panels.length === 0
            ? <EmptyState icon="drop" title="No lab results yet" body="Results ordered through a consult land here." />
            : <div className={s.grid}>{panels.map(p => <PanelRow key={p.panel} p={p} onOpen={() => onPanel(p.panel)} />)}</div>}
        </>
      )}

    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className={s.sectionTitle}>{children}</div>;
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return <div className={s.sectionSub}>{children}</div>;
}

function ConsultCard({ c }: { c: UserConsult }) {
  const [open, setOpen] = useState(false);
  const d = c.detail;
  return (
    <Card pad="15px 16px" className={s.consult}>
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
        <div className={s.consultHead}>
          <span className={s.consultIcon}><Icon name="stethoscope" size={17} /></span>
          <div className={s.consultTitle}>{c.title}</div>
          <span className={s.consultPill}><StatusPill status={c.status === 'Approved' ? 'approved' : c.status} /></span>
        </div>
        <div className={s.consultMeta}>{c.date} · Dr. Mira</div>
        <div className={s.consultNote}>{c.note}</div>
        {/* What was actually prescribed or ordered, on the closed card: the
            thing people scan their history for is the drug name, and having to
            open every entry to find it made the list useless for that. */}
        {d && (d.rx.length > 0 || d.tests.length > 0) && (
          <div className={s.chips}>
            {d.rx.map((x, i) => (
              <span key={`r${i}`} className={`${s.chip} ${s.chipRx}`}>
                <Icon name="pill" size={13} />{x.name}
              </span>
            ))}
            {d.tests.map((x, i) => (
              <span key={`t${i}`} className={`${s.chip} ${s.chipTest}`}>
                <Icon name="flask" size={13} />{x.name}
              </span>
            ))}
          </div>
        )}
        {d && (
          <div className={s.more}>
            {open ? 'Show less' : 'View details'}
            <span className={`${s.moreChev}${open ? ' ' + s.moreChevOpen : ''}`}>
              <Icon name="chevD" size={14} />
            </span>
          </div>
        )}
      </div>
      {d && open && (
        <div className={s.detail}>
          <MicroLabel>AI consultation summary</MicroLabel>
          <div className={s.detailText}>{d.summary}</div>
          <MicroLabel>Evaluation</MicroLabel>
          <div className={s.detailStrong}>{d.evaluation}</div>
          {(d.tests.length > 0 || d.rx.length > 0) && <MicroLabel>Next steps</MicroLabel>}
          {d.tests.map((x, i) => <div key={i} className={s.miniRow}><b>{x.name}</b> · {x.detail}</div>)}
          {d.rx.map((x, i) => <div key={i} className={s.miniRow}><b>{x.name}</b>{x.dosage ? ` · ${x.dosage}` : ''}{x.timing ? ` · ${x.timing}` : ''}</div>)}
          <MicroLabel>Advice</MicroLabel>
          <div className={s.detailText}>{d.advice}</div>
        </div>
      )}
    </Card>
  );
}

// A panel, not a value: the detail screen is where individual analytes get
// their range, their explanation and their history.
function PanelRow({ p, onOpen }: { p: LabPanel; onOpen: () => void }) {
  const ok = p.worst === 'normal';
  const t = ok ? tints.labOk : tints.labWarn;
  return (
    <Card level={1} pad="13px 15px" className={s.lab} onClick={onOpen} aria-label={`Open ${p.panel}`}>
      <span className={s.labIcon}><Icon name="flask" size={18} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className={s.labName}>{p.panel}</div>
        <div className={s.labDate}>
          {new Date(p.observedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          {' · '}{p.values.map(v => v.analyte).join(', ')}
        </div>
      </div>
      <span className={`vd-tag ${s.labResult}`} style={{ background: t.bg, color: t.fg }}>
        {ok ? 'In range' : 'Needs a look'}
      </span>
    </Card>
  );
}
