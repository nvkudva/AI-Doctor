// Review desk header: title, pending pill, notification bell + dropdown.
import { useClinic } from '../../../store';
import { AccountMenu, AppHeader, Icon, IconButton, Popover, Sheet } from '../../../lib/ui';
import { useBreakpoint } from '../../../shell/viewport';
import { ink, lines, pillStyle, radius, space, type } from '../../../lib/theme';
import { relAge } from './relativeTime';

export function DeskHeader({ tenantName, pendingCount, showNotifs, onToggleNotifs, onCloseNotifs, onSelectCase, filter }: {
  tenantName: string; pendingCount: number;
  showNotifs: boolean; onToggleNotifs: () => void; onCloseNotifs: () => void;
  onSelectCase: (id: string) => void;
  /** Desktop-only segmented filter, supplied by DoctorApp. */
  filter?: React.ReactNode;
}) {
  const clinic = useClinic();
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  const count = clinic.notices.length;
  // Align the full-bleed sticky header with the 1560/40 desk gutters.
  const pad = mobile ? '0 16px' : bp === 'tablet' ? '0 28px' : '0 max(40px, calc((100% - 1560px) / 2 + 40px))';
  return (
    <>
      <AppHeader
        title="Review"
        style={{ padding: pad }}
        badge={mobile && pendingCount > 0
          ? <span style={pillStyle('pending') as React.CSSProperties}>{pendingCount} pending</span>
          : undefined}
        subtitle={mobile ? undefined : `${tenantName} · ${pendingCount} pending`}
        actions={(
          <>
            {filter}
            <div style={{ position: 'relative', flex: 'none' }}>
              <IconButton
                icon="bell"
                label="Notifications"
                onClick={onToggleNotifs}
                aria-haspopup="menu"
                aria-expanded={showNotifs}
              />
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
              {!mobile && (
                <Popover
                  open={showNotifs}
                  onClose={onCloseNotifs}
                  label="Notifications"
                  align="right"
                  top={52}
                  width={360}
                  style={{ maxHeight: '60vh', overflowY: 'auto' }}
                >
                  <NoticeList onSelectCase={onSelectCase} onCloseNotifs={onCloseNotifs} />
                </Popover>
              )}
            </div>
            <AccountMenu
              name="Dr. Sara Whitfield"
              detail="General Physician · GMC-483920"
              extra={(
                <div style={{
                  display: 'flex', alignItems: 'center', gap: space[3], margin: `0 0 ${space[2]}px`, padding: '8px 12px',
                  background: 'var(--vd-ok-bg)', borderRadius: radius.pill, ...type.caption, color: 'var(--vd-ok-fg)',
                }}>
                  On duty · accepting reviews
                </div>
              )}
            />
          </>
        )}
      />
      {mobile && (
        <Sheet open={showNotifs} onClose={onCloseNotifs} title="Notifications" label="Notifications">
          <NoticeList onSelectCase={onSelectCase} onCloseNotifs={onCloseNotifs} />
        </Sheet>
      )}
    </>
  );
}

function NoticeList({ onSelectCase, onCloseNotifs }: { onSelectCase: (id: string) => void; onCloseNotifs: () => void }) {
  const clinic = useClinic();
  if (clinic.notices.length === 0) {
    return <div style={{ padding: space[4], ...type.footnote, color: ink.secondary }}>All caught up — no new notifications.</div>;
  }
  return (
    <>
      {clinic.notices.map((n, i) => (
        <div
          key={i}
          role="menuitem"
          tabIndex={0}
          aria-label={n.caseId ? `${n.t} — open case` : n.t}
          onClick={() => {
            if (n.caseId) onSelectCase(n.caseId);
            onCloseNotifs();
            clinic.dismissNotice(i);
          }}
          onKeyDown={e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            if (n.caseId) onSelectCase(n.caseId);
            onCloseNotifs();
            clinic.dismissNotice(i);
          }}
          style={{
            display: 'flex', gap: space[3], alignItems: 'flex-start', padding: `${space[2]}px ${space[1]}px`,
            minHeight: 44, borderBottom: `1px solid ${lines.hairline}`, cursor: n.caseId ? 'pointer' : 'default',
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
            onClick={e => { e.stopPropagation(); clinic.dismissNotice(i); }}
            onKeyDown={e => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              clinic.dismissNotice(i);
            }}
            style={{ cursor: 'pointer', color: ink.muted, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
          >
            <Icon name="x" size={16} />
          </span>
        </div>
      ))}
    </>
  );
}
