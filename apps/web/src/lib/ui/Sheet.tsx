// Modal surfaces: bottom sheet (centred ≥800) and anchored popover/menu.
// Both dismiss on Escape and outside tap, and sit above the bottom nav on
// the shared z-scale (DESIGN §11.7 / §11.8).
import { useRef } from 'react';
import { DismissCatcher, useDismiss, useFocusEntry, useFocusTrap } from './Dismiss';
import { Icon, type IconName } from './Primitives';
import s from './Sheet.module.css';

export function Sheet({
  open, onClose, title, children, footer, width = 480, label,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  label?: string;
}) {
  const dialog = useRef<HTMLDivElement | null>(null);
  useDismiss(onClose, open);
  // It declares aria-modal over a scrim, so it must also behave modally:
  // take focus on open, cycle Tab inside, hand focus back on close (QA-06).
  useFocusEntry(dialog, open);
  useFocusTrap(dialog, open);
  if (!open) return null;
  return (
    <div className={`vd-glass-thick ${s.scrim}`} onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label || (typeof title === 'string' ? title : 'Dialog')}
        onClick={e => e.stopPropagation()}
        className={s.dialog}
        style={{ '--sheet-w': `${width}px` } as React.CSSProperties}
      >
        <div className={s.grabber} />
        {title && <div className={s.title}>{title}</div>}
        {children}
        {footer && <div className={s.footer}>{footer}</div>}
      </div>
    </div>
  );
}

// Anchored menu/popover. The parent must be position: relative.
export function Popover({
  open, onClose, children, align = 'right', top = 52, width = 248, label, style,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
  top?: number;
  width?: number;
  label?: string;
  style?: React.CSSProperties;
}) {
  useDismiss(onClose, open);
  if (!open) return null;
  return (
    <>
      <DismissCatcher onClose={onClose} />
      <div
        role="menu"
        aria-label={label}
        className={`${s.popover} ${align === 'left' ? s.popLeft : s.popRight}`}
        style={{ '--pop-top': `${top}px`, '--pop-w': `${width}px`, ...style } as React.CSSProperties}
      >
        {children}
      </div>
    </>
  );
}

// A 44-high popover row. `danger` tints the label for destructive actions.
export function MenuRow({
  children, onClick, icon, danger, detail, disabled, style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: IconName;
  danger?: boolean;
  /** Secondary line under the label — why a disabled row is disabled, usually. */
  detail?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={[s.row, danger && s.rowDanger, disabled && s.rowDisabled].filter(Boolean).join(' ')}
      style={style}
    >
      {icon && <Icon name={icon} size={18} />}
      <span className={s.rowLabel}>
        {children}
        {detail && <span className={s.rowDetail}>{detail}</span>}
      </span>
    </button>
  );
}
