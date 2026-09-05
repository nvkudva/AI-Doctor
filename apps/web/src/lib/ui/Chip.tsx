// The one chip: suggestion chips, decline reasons, Mira quick commands.
// Selectable pill, 44 mobile / 40 tablet+ (DESIGN §7, §11.3).
import { ink, lines, radius, surfaces, type } from '../theme';
import { useBreakpoint } from '../../shell/viewport';
import { Icon, type IconName } from './Primitives';

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
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const shared: React.CSSProperties = {
    height: mobile ? 44 : 40,
    padding: `0 ${mobile ? 14 : 16}px`,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: radius.pill,
    ...(mobile ? type.footnote : type.footnoteT),
    fontWeight: 600,
    background: selected ? surfaces.bubbleMine : surfaces.card,
    color: selected ? ink.primary : ink.body,
    border: `1px solid ${selected ? 'transparent' : lines.strong}`,
    transition: 'background var(--vd-dur-2) var(--vd-ease-spring), color var(--vd-dur-2) var(--vd-ease-spring)',
    whiteSpace: 'nowrap',
    ...style,
  };
  const body = (
    <>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </>
  );
  if (!onSelect) return <span style={shared}>{body}</span>;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      title={title}
      aria-pressed={selected}
      style={{ ...shared, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      {body}
    </button>
  );
}
