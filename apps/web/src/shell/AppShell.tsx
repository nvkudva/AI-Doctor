import { useEffect, useState } from 'react';
import { pressProps } from '../lib/ui';
import s from './AppShell.module.css';

// AppShell: chrome-less full-viewport wrapper + update toast. Renders the
// active module edge-to-edge; each module owns its responsive layout.
// Module switching is URL-based (/patient, /doctor), not tab-based.

export function AppShell({ children }: { children: React.ReactNode }) {
  const [updateReady, setUpdateReady] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    // Gated SW update: never silently reload mid-consult.
    const onSW = () => setUpdateReady(true);
    const onOff = () => setOffline(true);
    const onOn = () => setOffline(false);
    window.addEventListener('vd:sw-update', onSW);
    window.addEventListener('offline', onOff);
    window.addEventListener('online', onOn);
    return () => {
      window.removeEventListener('vd:sw-update', onSW);
      window.removeEventListener('offline', onOff);
      window.removeEventListener('online', onOn);
    };
  }, []);

  return (
    <div className={s.shell}>
      {offline && (
        <div role="status" className={`vd-glass-thin ${s.offline}`}>
          You’re offline — consults and reviews need a connection.
        </div>
      )}
      <div className={s.main}>{children}</div>
      {updateReady && (
        <div {...pressProps(() => location.reload(), 'Reload to apply update')} className={s.toast}>
          Update ready — tap to reload
        </div>
      )}
    </div>
  );
}
