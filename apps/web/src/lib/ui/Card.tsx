// Solid content surfaces (DESIGN §8.2 — glass floats, solid holds content)
// and the shared empty state built on top of one.
import { Icon, type IconName } from './Primitives';
import s from './Card.module.css';

const TONE = { card: s.toneCard, panel: s.tonePanel, raised: s.toneRaised };

export function Card({
  children, tone = 'card', level, pad, bordered = true, onClick, selected, className, style,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  tone?: 'card' | 'panel' | 'raised';
  /** Elevation step 0–5. Omit to keep the CSS default (2). */
  level?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Override the per-breakpoint padding (16 / 20 / 24). */
  pad?: number | string;
  bordered?: boolean;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Required whenever onClick is set: a clickable card is a button, and its
   *  accessible name must say what activating it does (QA-12). */
  'aria-label'?: string;
}) {
  const edge = selected ? s.selected : bordered ? s.bordered : s.plain;
  return (
    <div
      className={[s.card, TONE[tone], edge, onClick && s.clickable, className].filter(Boolean).join(' ')}
      onClick={onClick}
      {...(onClick ? { role: 'button', tabIndex: 0, 'aria-label': ariaLabel, onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      } } : {})}
      style={{
        ...(level === undefined ? {} : { '--card-elev': `var(--vd-elev-${level})` }),
        ...(pad === undefined ? {} : { '--card-pad': typeof pad === 'number' ? `${pad}px` : pad }),
        ...style,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

// Centred empty state: 88 icon disc, headline + callout, optional action.
export function EmptyState({
  icon, title, body, action, style,
}: {
  icon?: IconName | React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const glyph = typeof icon === 'string'
    ? <div className={s.glyph}><Icon name={icon as IconName} size={34} /></div>
    : icon;
  return (
    <div className={s.empty} style={style}>
      {glyph}
      <div className={s.emptyTitle}>{title}</div>
      {body && <div className={s.emptyBody}>{body}</div>}
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}
