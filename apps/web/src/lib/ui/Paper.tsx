// The notepad surface. A prescription and a set of ordered tests are documents
// the patient is handed, not dashboard cards — so they get paper: a perforated
// top edge, ruled lines behind the content, and a torn-off look. Everything
// else in the app stays a Card (DESIGN §8.2).
import { Icon, type IconName } from './Primitives';
import s from './Paper.module.css';

export function Paper({ icon, title, meta, children, className }: {
  /** What this document is — the icon is the label's other half. */
  icon: IconName;
  title: string;
  /** Right-aligned on the header line: a date, a count, a status. */
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={[s.paper, className].filter(Boolean).join(' ')}>
      <div className={s.perforation} aria-hidden="true" />
      <div className={s.head}>
        <span className={s.icon}><Icon name={icon} size={18} /></span>
        <div className={s.title}>{title}</div>
        {meta && <div className={s.meta}>{meta}</div>}
      </div>
      <div className={s.body}>{children}</div>
    </div>
  );
}

/** One line-item on a notepad — a drug, or a test that was ordered. */
export function PaperItem({ icon, name, lead, why, meta, last, children }: {
  icon: IconName;
  name: string;
  /** Dosage and timing, or when the test is due. */
  lead?: string;
  why?: string;
  meta?: React.ReactNode;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${s.item}${last ? ' ' + s.itemLast : ''}`}>
      <span className={s.itemIcon}><Icon name={icon} size={17} /></span>
      <div className={s.itemBody}>
        <div className={s.itemHead}>
          <div className={s.itemName}>{name}</div>
          {meta}
        </div>
        {lead && <div className={s.itemLead}>{lead}</div>}
        {why && <div className={s.itemWhy}>{why}</div>}
        {children}
      </div>
    </div>
  );
}
