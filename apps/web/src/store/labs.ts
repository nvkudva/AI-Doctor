// Lab values, and the one honest sentence a patient needs beside each one.
// Nothing here diagnoses: it says where the number sits against its own
// reference range, and defers to the doctor for what to do about it.
import type { LabValue } from './types';

export interface LabPanel {
  panel: string;
  observedAt: number;
  values: LabValue[];
  /** Every earlier reading of the same analytes, oldest first. */
  history: Record<string, LabValue[]>;
  worst: LabValue['abnormal'];
}

const RANK: Record<LabValue['abnormal'], number> = {
  critical: 0, low: 1, high: 1, unknown: 2, normal: 3,
};

/** The latest reading per panel, with each analyte's earlier readings attached. */
export function toPanels(all: LabValue[]): LabPanel[] {
  const byPanel = new Map<string, LabValue[]>();
  for (const v of all) {
    const list = byPanel.get(v.panel) || [];
    list.push(v);
    byPanel.set(v.panel, list);
  }
  const panels: LabPanel[] = [];
  for (const [panel, rows] of byPanel) {
    const sorted = [...rows].sort((a, b) => b.observedAt - a.observedAt);
    const latestAt = sorted[0].observedAt;
    const values = sorted.filter(v => v.observedAt === latestAt);
    const history: Record<string, LabValue[]> = {};
    for (const v of sorted) {
      (history[v.analyte] ||= []).push(v);
    }
    for (const k of Object.keys(history)) history[k].reverse();
    panels.push({
      panel,
      observedAt: latestAt,
      values,
      history,
      worst: values.map(v => v.abnormal).sort((a, b) => RANK[a] - RANK[b])[0] || 'unknown',
    });
  }
  return panels.sort((a, b) => b.observedAt - a.observedAt);
}

/** Where the marker sits on the range bar, as a percentage. */
export function rangePosition(v: LabValue): number | null {
  if (v.value === null || v.refLow === null || v.refHigh === null || v.refHigh <= v.refLow) return null;
  const span = v.refHigh - v.refLow;
  // The bar shows the reference range across its middle half, so a value well
  // outside it still lands on the bar instead of falling off the end.
  const pct = 25 + ((v.value - v.refLow) / span) * 50;
  return Math.max(2, Math.min(98, pct));
}

export function formatValue(v: LabValue): string {
  if (v.text) return v.text;
  if (v.value === null) return '—';
  return v.unit ? `${v.value} ${v.unit}` : String(v.value);
}

export function rangeLabel(v: LabValue): string {
  if (v.refLow === null && v.refHigh === null) return 'No reference range on file';
  if (v.refLow === null) return `below ${v.refHigh}`;
  if (v.refHigh === null) return `above ${v.refLow}`;
  return `${v.refLow} – ${v.refHigh}${v.unit ? ' ' + v.unit : ''}`;
}

const DIRECTION: Record<string, string> = {
  low: 'below', high: 'above', critical: 'far outside',
};

/**
 * One sentence per value: where it sits, and what that measurement is for.
 * The `MEANING` table is deliberately short — a value with no entry gets the
 * position and nothing invented on top of it.
 */
const MEANING: Record<string, string> = {
  ferritin: 'Ferritin is your iron store — the reserve behind your blood count.',
  haemoglobin: 'Haemoglobin is what carries oxygen around your body.',
  hemoglobin: 'Haemoglobin is what carries oxygen around your body.',
  'ldl cholesterol': 'LDL is the cholesterol that builds up in artery walls.',
  hba1c: 'HbA1c is your average blood sugar over the last two to three months.',
  tsh: 'TSH is the signal your body sends when it wants more thyroid hormone.',
  'free t4': 'Free T4 is the thyroid hormone actually circulating.',
  crp: 'CRP rises when there is inflammation somewhere in the body.',
  'ige total': 'Total IgE rises with allergy and some infections.',
  'peak flow (best)': 'Peak flow is how hard you can blow out — a measure of how open your airways are.',
};

export function explain(v: LabValue): string {
  const what = MEANING[v.analyte.toLowerCase()] || '';
  if (v.abnormal === 'normal') {
    return `Inside the normal range.${what ? ' ' + what : ''}`;
  }
  const dir = DIRECTION[v.abnormal];
  if (!dir) return what || 'No reference range on file for this value.';
  return `${cap(dir)} the normal range.${what ? ' ' + what : ''}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Whether the analyte moved toward its range since the previous reading. */
export function trendNote(history: LabValue[]): string {
  if (history.length < 2) return '';
  const prev = history[history.length - 2];
  const now = history[history.length - 1];
  if (prev.value === null || now.value === null) return '';
  if (prev.abnormal !== 'normal' && now.abnormal === 'normal') return 'Back inside the normal range since the last test.';
  if (prev.abnormal === 'normal' && now.abnormal !== 'normal') return 'This has moved out of range since the last test.';
  const delta = now.value - prev.value;
  if (Math.abs(delta) < Number.EPSILON) return 'Unchanged since the last test.';
  return `${delta > 0 ? 'Up' : 'Down'} from ${prev.value} at the last test.`;
}
