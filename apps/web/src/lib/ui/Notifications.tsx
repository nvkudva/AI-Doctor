// The header bell and its notice list, shared by both modules: a Popover at
// ≥800, a Sheet on mobile. Notices come from the clinic store via props so
// this stays presentational.
import { relAge } from '../core';
import { useBreakpoint } from '../../shell/viewport';
import { Icon } from './Primitives';
import { IconButton } from './Button';
import { Popover, Sheet } from './Sheet';
import s from './Notifications.module.css';

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
    <div className={s.wrap}>
      <IconButton icon="bell" label="Notifications" onClick={onToggle} aria-haspopup="menu" aria-expanded={open} />
      {count > 0 && (
        <span className={s.badge}>
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
    return <div className={s.empty}>All caught up — no new notifications.</div>;
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
            className={`${s.notice}${clickable ? ' ' + s.noticeOpenable : ''}`}
          >
            <span className={s.dot} />
            <div className={s.text}>
              <div className={s.noticeTitle}>{n.t}</div>
              <div className={s.noticeBody}>{n.d}{n.at ? ` · ${relAge(n.at)}` : ''}</div>
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
              className={s.dismiss}
            >
              <Icon name="x" size={16} />
            </span>
          </div>
        );
      })}
    </>
  );
}
