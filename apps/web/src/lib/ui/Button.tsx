// The one button. Five variants (DESIGN §7), per-breakpoint metrics, tokens
// only. Replaces every raw <button> and div-CTA in the modules.
import { Icon, type IconName } from './Primitives';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'approve';

const SIZE: Record<ButtonVariant, string> = {
  primary: s.sizePrimary,
  danger: s.sizePrimary,
  secondary: s.sizeSecondary,
  tertiary: s.sizeTertiary,
  approve: s.sizeApprove,
};

const SKIN: Record<ButtonVariant, string> = {
  primary: s.skinPrimary,
  secondary: s.skinSecondary,
  tertiary: s.skinTertiary,
  danger: s.skinDanger,
  approve: s.skinApprove,
};

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
  className?: string;
  style?: React.CSSProperties;
}

export function Button({
  children, variant = 'primary', onClick, disabled, fullWidth, icon, iconRight,
  half, width, htmlType = 'button', className, style, ...aria
}: ButtonProps) {
  const cls = [
    s.btn, SIZE[variant], SKIN[variant],
    !children && s.iconOnly,
    fullWidth && s.fullWidth,
    half === 'left' ? s.halfLeft : half === 'right' ? s.halfRight : null,
    disabled && s.disabled,
    className,
  ].filter(Boolean).join(' ');
  return (
    <button
      type={htmlType}
      onClick={onClick}
      disabled={disabled}
      className={cls}
      {...aria}
      style={{ ...(width === undefined ? {} : { width }), ...style }}
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
  const glass = tone === 'glass';
  const cls = [
    s.icon,
    glass ? `vd-glass ${s.iconGlass}` : tone === 'card' ? s.iconCard : s.iconPlain,
  ].join(' ');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      {...aria}
      className={cls}
      style={{ ...(size === undefined ? {} : { '--icon-btn-size': `${size}px` }), ...style } as React.CSSProperties}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
