// Review desk header: greeting title, pending pill, notification bell, account.
import { useClinic } from '../../../store';
import { AppHeader, NotifyButton, ThemeToggle, greeting } from '../../../lib/ui';
import { useAuth } from '../../../shell/auth';
import { useBreakpoint } from '../../../shell/viewport';
import s from './DeskHeader.module.css';

export function DeskHeader({ tenantName, pendingCount, showNotifs, onToggleNotifs, onCloseNotifs, onSelectCase, filter }: {
  tenantName: string; pendingCount: number;
  showNotifs: boolean; onToggleNotifs: () => void; onCloseNotifs: () => void;
  onSelectCase: (id: string) => void;
  /** Desktop-only segmented filter, supplied by DoctorApp. */
  filter?: React.ReactNode;
}) {
  const clinic = useClinic();
  const { user } = useAuth();
  const mobile = useBreakpoint() === 'mobile';
  return (
    <AppHeader
      title={greeting(user?.name || 'Dr. Sara Whitfield')}
      className={s.header}
      subtitle={mobile ? undefined : `${tenantName} · ${pendingCount} pending`}
      actions={(
        <>
          {filter}
          <ThemeToggle />
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
