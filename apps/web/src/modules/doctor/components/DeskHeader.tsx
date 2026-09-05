// Review desk header: title, tenant, notification bell + dropdown.
import { useClinic } from '../../../store';
import { AccountMenu, DismissCatcher, Icon, pressProps, useDismiss } from '../../../lib/ui';
import { ink, surfaces, type, z } from '../../../lib/theme';
import { relAge } from './time';

export function DeskHeader({ tenantName, pendingCount, mobile, showNotifs, onToggleNotifs, onCloseNotifs, onSelectCase }: {
  tenantName: string; pendingCount: number; mobile: boolean;
  showNotifs: boolean; onToggleNotifs: () => void; onCloseNotifs: () => void;
  onSelectCase: (id: string) => void;
}) {
  const clinic = useClinic();
  useDismiss(onCloseNotifs, showNotifs);
  return (
    <>
      <div style={{ position: 'relative', zIndex: z.header, padding: mobile ? '14px 12px 10px' : '20px 28px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...type.largeTitle, color: ink.primary, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Review</div>
          <div {...pressProps(onToggleNotifs, "Notifications")} aria-expanded={showNotifs} title="Notifications" style={{ cursor: 'pointer', position: 'relative', width: 44, height: 44, borderRadius: 99, background: 'var(--vd-glass-bg)', backdropFilter: 'var(--vd-glass-blur)', WebkitBackdropFilter: 'var(--vd-glass-blur)', border: '1px solid var(--vd-glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ink.onGlass, boxShadow: '0 3px 12px rgba(90,70,170,.22)', flex: 'none' }}>
            <Icon name="bell" size={19} />
            {clinic.notices.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 99, background: 'oklch(0.62 0.21 20)', color: 'var(--vd-ink-on-brand)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {clinic.notices.length}
              </span>
            )}
          </div>
          <AccountMenu
            name="Dr. Sara Whitfield"
            detail="General Physician · GMC-483920"
            extra={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 6px', padding: '8px 12px', background: 'var(--vd-ok-bg)', borderRadius: 99, fontSize: 11, fontWeight: 600, color: 'var(--vd-ok-fg)' }}>
                On duty · accepting reviews
              </div>
            )}
          />
        </div>
        <div style={{ ...type.footnote, color: ink.soft, marginTop: 2 }}>{tenantName} · {pendingCount} pending</div>
      </div>

      {showNotifs && <DismissCatcher onClose={onCloseNotifs} />}
      {showNotifs && (
        <div role="menu" aria-label="Notifications" style={{ position: mobile ? 'fixed' : 'absolute', zIndex: z.popover, top: mobile ? 70 : 64, right: mobile ? 12 : 18, left: mobile ? 12 : undefined, width: mobile ? undefined : 320, maxWidth: mobile ? undefined : 'calc(100% - 36px)', maxHeight: '60vh', overflowY: 'auto', background: surfaces.card, borderRadius: 16, padding: 12, boxShadow: '0 20px 50px rgba(12,20,60,.4)' }}>
          {clinic.notices.length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: ink.secondary }}>All caught up — no new notifications.</div>
          )}
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
              style={{ display: 'flex', gap: 8, padding: '8px 4px', borderBottom: '1px solid var(--vd-border)', fontSize: 13, cursor: n.caseId ? 'pointer' : 'default' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--vd-nav-active)', flex: 'none', marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <b style={{ color: ink.primary }}>{n.t}</b>
                <div style={{ color: ink.secondary, fontSize: 12 }}>{n.d}{n.at ? ` · ${relAge(n.at)}` : ''}</div>
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
                style={{ cursor: 'pointer', color: ink.muted, fontSize: 16, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
              >
                ×
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
