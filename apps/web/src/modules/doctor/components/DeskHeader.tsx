// Review desk header: the work, the pending pill, notification bell, account.
import { useClinic } from '../../../store';
import { AppHeader, NotifyButton, ThemeToggle } from '../../../lib/ui';
import { useAuth } from '../../../shell/auth';
import { useBreakpoint } from '../../../shell/viewport';
import s from './DeskHeader.module.css';

export function DeskHeader({ title, tenantName, pendingCount, urgentCount = 0, showNotifs, onToggleNotifs, onCloseNotifs, onSelectCase, filter }: {
  /** The screen's own name. Home falls back to the work itself (D18, D34). */
  title?: string;
  tenantName: string; pendingCount: number; urgentCount?: number;
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
      // A console opens on the work, not on the time of day: "Good evening,
      // Sara" is the one line on the screen that cannot be acted on (D34).
      title={title || 'Reviews'}
      className={s.header}
      subtitle={mobile
        ? `${pendingCount} waiting${urgentCount ? ` · ${urgentCount} urgent` : ''}`
        : `${tenantName} · ${pendingCount} waiting${urgentCount ? ` · ${urgentCount} urgent` : ''}`}
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
