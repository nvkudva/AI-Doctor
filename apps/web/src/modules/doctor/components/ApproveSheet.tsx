// The signature step. Approving converts an AI draft into a live prescription,
// so it is not a tap: this sheet restates who is being prescribed for, exactly
// what they will receive, and every safety flag still standing, and it does not
// arm `Sign and send` until the doctor accepts clinical responsibility for it
// (DESIGN-REVIEW D2).
import type { CaseItem, SafetyFlag } from '../../../lib/core';
import { Button, Sheet } from '../../../lib/ui';
import s from './ApproveSheet.module.css';

/** A flag the doctor has not dealt with: 'info' is a check that passed. */
export function unresolved(flags: SafetyFlag[]): SafetyFlag[] {
  return flags.filter(f => f.severity !== 'info');
}

/** Gaps in the record that a signature cannot stand on. */
const BLOCKING = new Set(['demographics_missing']);

export function blockers(flags: SafetyFlag[]): SafetyFlag[] {
  return flags.filter(f => BLOCKING.has(f.code));
}

export function ApproveSheet({ ac, open, accepted, onAccept, onCancel, onConfirm }: {
  ac: CaseItem;
  open: boolean;
  accepted: boolean;
  onAccept: (next: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const rx = ac.rec.items.filter(i => !!(i.dosage && i.dosage.trim()));
  const tests = ac.rec.items.filter(i => !(i.dosage && i.dosage.trim()));
  const flags = unresolved(ac.flags);
  // A plan signed without the facts the dose was chosen from is the failure the
  // review step exists to catch, so the signature is withheld rather than
  // merely warned about (D33).
  const blocked = blockers(ac.flags);
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title="Sign this plan?"
      label="Sign this plan"
      width={520}
      footer={(
        <>
          <Button variant="tertiary" onClick={onCancel} style={{ flex: 1 }}>Cancel</Button>
          <Button variant="approve" disabled={!accepted || blocked.length > 0} onClick={onConfirm} style={{ flex: 2 }}>
            Sign and send
          </Button>
        </>
      )}
    >
      <div className={s.who}>
        <div className={s.patient}>{ac.patient}</div>
        <div className={s.demo}>{ac.demo}</div>
      </div>

      {blocked.length > 0 && (
        <div className={s.blocked} role="status">
          <b>This plan cannot be signed yet.</b>
          {blocked.map((f, n) => <div key={n}>{f.text}</div>)}
          <div>Add the missing details to the patient record, then reopen this case.</div>
        </div>
      )}

      <Section
        label={rx.length === 0 ? 'Medicines' : rx.length === 1 ? 'Prescribing 1 medicine' : `Prescribing ${rx.length} medicines`}
        empty={!rx.length && 'None — this plan orders tests only.'}
      >
        {rx.map((i, n) => (
          <div key={n} className={s.item}>
            <span className={s.itemName}>{i.name}</span>
            <span className={s.itemDose}>{i.dosage} · {i.timing}</span>
          </div>
        ))}
      </Section>

      {tests.length > 0 && (
        <Section label={tests.length === 1 ? 'Ordering 1 test' : `Ordering ${tests.length} tests`}>
          {tests.map((i, n) => (
            <div key={n} className={s.item}>
              <span className={s.itemName}>{i.name}</span>
              <span className={s.itemDose}>{i.timing}</span>
            </div>
          ))}
        </Section>
      )}

      {flags.length > 0 && (
        <Section label={flags.length === 1 ? '1 unresolved safety flag' : `${flags.length} unresolved safety flags`} danger>
          {flags.map((f, n) => (
            <div key={n} className={s.item}>
              <span className={s.itemName}>{f.code.replace(/_/g, ' ')}</span>
              <span className={s.flagText}>{f.text}</span>
            </div>
          ))}
        </Section>
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={accepted}
        onClick={() => onAccept(!accepted)}
        className={s.accept}
      >
        <span aria-hidden className={`${s.box}${accepted ? ' ' + s.boxOn : ''}`}>
          {accepted ? '✓' : ''}
        </span>
        I have reviewed this plan and take clinical responsibility for it.
      </button>
    </Sheet>
  );
}

function Section({ label, children, danger, empty }: {
  label: string; children?: React.ReactNode; danger?: boolean; empty?: string | false;
}) {
  return (
    <section className={s.section}>
      <div className={danger ? `${s.label} ${s.labelDanger}` : s.label}>{label}</div>
      {empty ? <div className={s.empty}>{empty}</div> : children}
    </section>
  );
}
