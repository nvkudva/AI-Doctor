// The one button. Five variants (DESIGN §7), per-breakpoint metrics, tokens
// only. Replaces every raw <button> and div-CTA in the modules.
import { gradients, ink, lines, radius, surfaces, type, type Breakpoint } from '../theme';
import { useBreakpoint } from '../../shell/viewport';
import { Icon, type IconName } from './Primitives';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'approve';

interface Metrics { h: number; padX: number; font: React.CSSProperties }

function metrics(variant: ButtonVariant, bp: Breakpoint): Metrics {
  const label = { ...type.body, ...(bp === 'mobile' ? {} : type.bodyT) };
  const small = { ...(bp === 'mobile' ? type.subhead : type.subheadT) };
  switch (variant) {
    case 'secondary':
      return { h: bp === 'mobile' ? 48 : 50, padX: bp === 'mobile' ? 20 : 24, font: { ...small, fontWeight: 700 } };
    case 'tertiary':
      return { h: 48, padX: 20, font: { ...small, fontWeight: 600 } };
    case 'approve':
      return { h: 48, padX: 18, font: { ...label, fontWeight: 700 } };
    default:
      return {
        h: bp === 'mobile' ? 48 : bp === 'tablet' ? 50 : 52,
        padX: bp === 'mobile' ? 24 : bp === 'tablet' ? 28 : 32,
        font: { ...label, fontWeight: 700 },
      };
  }
}

function skin(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'secondary':
      return { background: surfaces.chip, color: ink.primary, border: '1px solid transparent' };
    case 'tertiary':
      return { background: 'transparent', color: ink.body, border: `1px solid ${lines.strong}` };
    case 'danger':
      return { background: gradients.danger, color: ink.onBrand, border: '1px solid transparent', boxShadow: 'var(--vd-elev-2)' };
    case 'approve':
      return { background: gradients.approve, color: ink.onApprove, border: '1px solid transparent', boxShadow: 'var(--vd-elev-2)' };
    default:
      return { background: gradients.primary, color: ink.onBrand, border: '1px solid transparent', boxShadow: 'var(--vd-shadow-cta)' };
  }
}

export interface ButtonProps {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Leading icon from the shared set. */
  icon?: IconName;
  /** Trailing icon (e.g. a disclosure chevron). */
  iconRight?: IconName;
  /** Split-pill half: 'left' keeps the label, 'right' is the 48-wide chevron. */
  half?: 'left' | 'right';
  width?: number | string;
  title?: string;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'menu' | 'dialog';
  htmlType?: 'button' | 'submit';
  style?: React.CSSProperties;
}

export function Button({
  children, variant = 'primary', onClick, disabled, fullWidth, icon, iconRight,
  half, width, htmlType = 'button', style, ...aria
}: ButtonProps) {
  const bp = useBreakpoint();
  const m = metrics(variant, bp);
  const iconOnly = !children;
  const corner = radius.xl;
  const shape: React.CSSProperties =
    half === 'left' ? { borderRadius: `${corner}px 0 0 ${corner}px` }
      : half === 'right' ? { borderRadius: `0 ${corner}px ${corner}px 0` }
        : { borderRadius: radius.pill };
  return (
    <button
      type={htmlType}
      onClick={onClick}
      disabled={disabled}
      {...aria}
      style={{
        height: m.h,
        minWidth: iconOnly ? 48 : undefined,
        width: width ?? (fullWidth ? '100%' : undefined),
        padding: iconOnly ? 0 : `0 ${m.padX}px`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : undefined,
        whiteSpace: 'nowrap',
        ...m.font,
        ...skin(variant),
        ...shape,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={18} />}
    </button>
  );
}

// Circular glass action button — headers, toolbars, back affordances.
// 44 on coarse pointers, 40 visual at desktop with the hit area preserved.
export function IconButton({
  icon, onClick, label, tone = 'glass', size, style, ...aria
}: {
  icon: IconName;
  onClick?: () => void;
  label: string;
  tone?: 'glass' | 'card' | 'plain';
  size?: number;
  style?: React.CSSProperties;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'menu' | 'dialog';
}) {
  const bp = useBreakpoint();
  const d = size ?? (bp === 'desktop' ? 40 : 44);
  const glass = tone === 'glass';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      {...aria}
      className={glass ? 'vd-glass' : undefined}
      style={{
        width: d, height: d, flex: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: radius.pill, cursor: 'pointer', color: glass ? ink.onGlass : ink.body,
        background: tone === 'card' ? surfaces.card : glass ? undefined : 'transparent',
        border: tone === 'card' ? `1px solid ${lines.hairline}` : glass ? undefined : '1px solid transparent',
        boxShadow: tone === 'card' ? 'var(--vd-elev-1)' : glass ? 'var(--vd-glass-hi), var(--vd-elev-1)' : 'none',
        ...style,
      }}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
