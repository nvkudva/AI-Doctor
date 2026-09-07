// One lab panel, explained: the value against its own reference range, one
// honest sentence about where it sits, and the readings before it. Nothing here
// diagnoses — it says what was measured and defers to the doctor for the rest.
import { Button, Card, MicroLabel } from '../../../lib/ui';
import { explain, formatValue, rangeLabel, rangePosition, trendNote, type LabPanel } from '../../../store/labs';
import type { LabValue } from '../../../store/types';
import s from './LabPanelScreen.module.css';

const TONE: Record<LabValue['abnormal'], { bg: string; fg: string; label: string }> = {
  normal: { bg: 'var(--vd-lab-ok-bg)', fg: 'var(--vd-lab-ok-fg)', label: 'In range' },
  low: { bg: 'var(--vd-lab-warn-bg)', fg: 'var(--vd-lab-warn-fg)', label: 'Needs a look' },
  high: { bg: 'var(--vd-lab-warn-bg)', fg: 'var(--vd-lab-warn-fg)', label: 'Needs a look' },
  critical: { bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)', label: 'Urgent' },
  unknown: { bg: 'var(--vd-neutral-bg)', fg: 'var(--vd-neutral-fg)', label: 'No range' },
};

export function LabPanelScreen({ panel, doctorNote, onBack }: {
  panel: LabPanel;
  /** What the doctor already said about this, when a plan covers it. */
  doctorNote?: string;
  onBack: () => void;
}) {
  const tone = TONE[panel.worst];
  const report = panel.values.find(v => v.reportPath)?.reportPath;
  return (
    <div className={s.screen}>
      <div className={s.top}>
        <Button variant="secondary" icon="chevL" onClick={onBack} className={s.back}>Labs</Button>
        <div className={s.pageTitle}>{panel.panel}</div>
      </div>

      <Card className={s.card}>
        <div className={s.head}>
          <span className="vd-tag" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
          <span className={s.when}>
            {new Date(panel.observedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        {panel.values.map(v => <ValueRow key={v.id} v={v} history={panel.history[v.analyte] || []} />)}
      </Card>

      {doctorNote && (
        <Card className={s.means} tone="panel" bordered={false}>
          <MicroLabel>What this means</MicroLabel>
          <div className={s.meansText}>{doctorNote}</div>
          <div className={s.meansFoot}>From the plan Dr. Whitfield approved.</div>
        </Card>
      )}

      {panel.values.map(v => {
        const h = panel.history[v.analyte] || [];
        if (h.length < 2) return null;
        return (
          <div key={`t${v.id}`}>
            <MicroLabel>{v.analyte} over time</MicroLabel>
            <Card level={1} className={s.trendCard}>
              <Trend history={h} />
              <div className={s.trendAxis}>
                {[h[0], h[h.length - 1]].map((x, i) => (
                  <span key={i}>{new Date(x.observedAt).toLocaleDateString(undefined, { month: 'short' })}</span>
                ))}
              </div>
            </Card>
          </div>
        );
      })}

      <div className={s.actions}>
        <Button
          variant="secondary"
          fullWidth
          icon="doc"
          disabled={!report}
          title={report ? undefined : 'No report file on this result'}
          onClick={() => { /* report delivery lands with storage signing */ }}
        >
          {report ? 'Report PDF' : 'No report file'}
        </Button>
      </div>
    </div>
  );
}

function ValueRow({ v, history }: { v: LabValue; history: LabValue[] }) {
  const pos = rangePosition(v);
  const tone = TONE[v.abnormal];
  const trend = trendNote(history);
  return (
    <div className={s.value}>
      <div className={s.valueHead}>
        <div className={s.analyte}>{v.analyte}</div>
        <div className={s.reading} style={{ color: tone.fg }}>{formatValue(v)}</div>
      </div>
      {pos !== null ? (
        <>
          <div className={s.bar}>
            <span className={s.marker} style={{ left: `${pos}%` }} />
          </div>
          <div className={s.scale}>
            <span>{v.refLow}</span>
            <span>normal range</span>
            <span>{v.refHigh}</span>
          </div>
        </>
      ) : (
        <div className={s.noRange}>{rangeLabel(v)}</div>
      )}
      <div className={s.explain}>{explain(v)}{trend ? ` ${trend}` : ''}</div>
    </div>
  );
}

// A plain polyline: the reference band behind it, one dot per reading, the
// latest ringed. No axis labels beyond the two months below it.
function Trend({ history }: { history: LabValue[] }) {
  const W = 300;
  const H = 84;
  const vals = history.map(h => h.value ?? 0);
  const lo = Math.min(...vals, history[0].refLow ?? Math.min(...vals));
  const hi = Math.max(...vals, history[0].refHigh ?? Math.max(...vals));
  const span = hi - lo || 1;
  const x = (i: number) => 12 + (i * (W - 24)) / Math.max(1, history.length - 1);
  const y = (v: number) => H - 12 - ((v - lo) / span) * (H - 26);
  const band = history[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.trend} role="img" aria-label="Trend over time">
      {band.refLow !== null && band.refHigh !== null && (
        <rect
          x="0"
          y={y(band.refHigh)}
          width={W}
          height={Math.max(2, y(band.refLow) - y(band.refHigh))}
          rx="6"
          className={s.band}
        />
      )}
      <polyline points={history.map((h, i) => `${x(i)},${y(h.value ?? 0)}`).join(' ')} className={s.line} />
      {history.map((h, i) => (
        <circle
          key={h.id}
          cx={x(i)}
          cy={y(h.value ?? 0)}
          r={i === history.length - 1 ? 5 : 4}
          className={h.abnormal === 'normal' ? s.dotOk : s.dotWarn}
        />
      ))}
    </svg>
  );
}
