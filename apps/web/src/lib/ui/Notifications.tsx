// The header bell and its notice list, shared by both modules: a Popover at
// ≥800, a Sheet on mobile. Notices come from the clinic store via props so
// this stays presentational.
import { relAge } from '../core';
import { ink, lines, radius, space, type } from '../theme';
import { useBreakpoint } from '../../shell/viewport';
import { Icon } from './Primitives';
import { IconButton } from './Button';
import { Popover, Sheet } from './Sheet';

export interface NoticeEntry { t: string; d: string; at?: number; caseId?: string }

/** Bell button with an unread count badge, plus its popover/sheet. */
export function NotifyButton({ notices, open, onToggle, onClose, onSelectCase, onDismiss }: {
  notices: NoticeEntry[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelectCase?: (caseId: string) => void;
  onDismiss: (index: number) => void;
}) {
  const mobile = useBreakpoint() === 'mobile';
  const count = notices.length;
  const list = <NoticeList notices={notices} onSelectCase={onSelectCase} onClose={onClose} onDismiss={onDismiss} />;
  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <IconButton icon="bell" label="Notifications" onClick={onToggle} aria-haspopup="menu" aria-expanded={open} />
      {count > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: radius.pill,
          background: 'var(--vd-bad-bg)', color: 'var(--vd-bad-fg)', border: `1px solid ${lines.hairline}`,
          ...type.micro, letterSpacing: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 5px', pointerEvents: 'none',
        }}>
          {count}
        </span>
      )}
      {mobile ? (
        <Sheet open={open} onClose={onClose} title="Notifications" label="Notifications">{list}</Sheet>
      ) : (
        <Popover
          open={open}
          onClose={onClose}
          label="Notifications"
          align="right"
          top={52}
          width={360}
          style={{ maxHeight: '60vh', overflowY: 'auto' }}
        >
          {list}
        </Popover>
      )}
    </div>
  );
}

function NoticeList({ notices, onSelectCase, onClose, onDismiss }: {
  notices: NoticeEntry[];
  onSelectCase?: (caseId: string) => void;
  onClose: () => void;
  onDismiss: (index: number) => void;
}) {
  if (notices.length === 0) {
    return <div style={{ padding: space[4], ...type.footnote, color: ink.secondary }}>All caught up — no new notifications.</div>;
  }
  const openNotice = (n: NoticeEntry, i: number) => {
    if (n.caseId && onSelectCase) onSelectCase(n.caseId);
    onClose();
    onDismiss(i);
  };
  return (
    <>
      {notices.map((n, i) => {
        const clickable = !!(n.caseId && onSelectCase);
        return (
          <div
            key={i}
            role="menuitem"
            tabIndex={0}
            aria-label={clickable ? `${n.t} — open case` : n.t}
            onClick={() => openNotice(n, i)}
            onKeyDown={e => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              openNotice(n, i);
            }}
            style={{
              display: 'flex', gap: space[3], alignItems: 'flex-start', padding: `${space[2]}px ${space[1]}px`,
              minHeight: 44, borderBottom: `1px solid ${lines.hairline}`, cursor: clickable ? 'pointer' : 'default',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--vd-nav-active)', flex: 'none', marginTop: 8 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...type.footnote, fontWeight: 700, color: ink.primary }}>{n.t}</div>
              <div style={{ ...type.footnote, color: ink.secondary }}>{n.d}{n.at ? ` · ${relAge(n.at)}` : ''}</div>
            </div>
            <span
              role="button"
              tabIndex={0}
              aria-label="Dismiss notification"
              onClick={e => { e.stopPropagation(); onDismiss(i); }}
              onKeyDown={e => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                onDismiss(i);
              }}
              style={{ cursor: 'pointer', color: ink.muted, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
            >
              <Icon name="x" size={16} />
            </span>
          </div>
        );
      })}
    </>
  );
}
