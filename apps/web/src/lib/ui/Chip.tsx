// The one chip: suggestion chips, decline reasons, Mira quick commands.
// Selectable pill, 44 mobile / 40 tablet+ (DESIGN §7, §11.3).
import { Icon, type IconName } from './Primitives';
import s from './Chip.module.css';

export function Chip({
  children, selected = false, onSelect, icon, disabled, title, style,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  icon?: IconName;
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
}) {
  const cls = [s.chip, selected && s.selected].filter(Boolean).join(' ');
  const body = (
    <>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </>
  );
  if (!onSelect) return <span className={cls} style={style}>{body}</span>;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      title={title}
      aria-pressed={selected}
      className={`${cls} ${disabled ? s.disabled : s.pressable}`}
      style={style}
    >
      {body}
    </button>
  );
}
