// Review desk header: greeting title, pending pill, notification bell, account.
import { useClinic } from '../../../store';
import { AppHeader, NotifyButton, greeting } from '../../../lib/ui';
import { useAuth } from '../../../shell/auth';
import { useBreakpoint } from '../../../shell/viewport';

export function DeskHeader({ tenantName, pendingCount, showNotifs, onToggleNotifs, onCloseNotifs, onSelectCase, filter }: {
  tenantName: string; pendingCount: number;
  showNotifs: boolean; onToggleNotifs: () => void; onCloseNotifs: () => void;
  onSelectCase: (id: string) => void;
  /** Desktop-only segmented filter, supplied by DoctorApp. */
  filter?: React.ReactNode;
}) {
  const clinic = useClinic();
  const { user } = useAuth();
  const bp = useBreakpoint();
  const mobile = bp === 'mobile';
  // Align the full-bleed sticky header with the 1560/40 desk gutters.
  const pad = mobile ? '0 16px' : bp === 'tablet' ? '0 28px' : '0 max(40px, calc((100% - 1560px) / 2 + 40px))';
  return (
    <AppHeader
      title={greeting(user?.name || 'Dr. Sara Whitfield')}
      style={{ padding: pad }}
      subtitle={mobile ? undefined : `${tenantName} · ${pendingCount} pending`}
      actions={(
        <>
          {filter}
          <NotifyButton
            notices={clinic.notices}
            open={showNotifs}
            onToggle={onToggleNotifs}
            onClose={onCloseNotifs}
            onSelectCase={onSelectCase}
            onDismiss={clinic.dismissNotice}
          />
        </>
      )}
    />
  );
}
