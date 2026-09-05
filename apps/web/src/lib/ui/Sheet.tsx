// Modal surfaces: bottom sheet (centred ≥800) and anchored popover/menu.
// Both dismiss on Escape and outside tap, and sit above the bottom nav on
// the shared z-scale (DESIGN §11.7 / §11.8).
import { ink, lines, radius, surfaces, type, z } from '../theme';
import { useBreakpoint } from '../../shell/viewport';
import { DismissCatcher, useDismiss } from './Dismiss';
import { Icon, type IconName } from './Primitives';

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
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  useDismiss(onClose, open);
  if (!open) return null;
  return (
    <div
      className="vd-glass-thick"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: z.sheet, background: 'var(--vd-scrim)',
        border: 'none', borderRadius: 0, boxShadow: 'none',
        display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center',
        padding: mobile ? 0 : 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label || (typeof title === 'string' ? title : 'Dialog')}
        onClick={e => e.stopPropagation()}
        style={{
          width: mobile ? '100%' : width, maxWidth: '100%', maxHeight: mobile ? '86dvh' : '80dvh',
          overflowY: 'auto', background: surfaces.card,
          borderRadius: mobile ? `${radius.xl}px ${radius.xl}px 0 0` : radius.xl,
          boxShadow: 'var(--vd-elev-5)',
          padding: `12px ${mobile ? 20 : 24}px calc(${mobile ? 20 : 24}px + env(safe-area-inset-bottom))`,
          animation: 'vd-slidein var(--vd-dur-4) var(--vd-ease-spring) both',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: radius.pill, background: lines.strong, margin: '0 auto 14px' }} />
        {title && (
          <div style={{ ...(mobile ? type.title : type.titleT), color: ink.primary, marginBottom: 10 }}>{title}</div>
        )}
        {children}
        {footer && <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>{footer}</div>}
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
        style={{
          position: 'absolute', zIndex: z.popover, top, width, minWidth: 220,
          left: align === 'left' ? 0 : undefined, right: align === 'right' ? 0 : undefined,
          background: surfaces.card, border: `1px solid ${lines.hairline}`,
          borderRadius: radius.lg, padding: 8, boxShadow: 'var(--vd-elev-5)',
          animation: 'vd-pop var(--vd-dur-3) var(--vd-ease-out) both',
          ...style,
        }}
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
      style={{
        width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 10px', borderRadius: radius.sm, border: 'none', background: 'transparent',
        cursor: disabled ? 'default' : 'pointer', textAlign: 'left', ...type.callout, fontWeight: 600,
        color: disabled ? ink.muted : danger ? 'var(--vd-bad-fg)' : ink.body, ...style,
      }}
    >
      {icon && <Icon name={icon} size={18} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        {children}
        {detail && (
          <span style={{ display: 'block', ...type.footnote, fontWeight: 500, color: ink.muted }}>{detail}</span>
        )}
      </span>
    </button>
  );
}
