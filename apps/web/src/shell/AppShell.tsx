import { useEffect, useState } from 'react';
import { pressProps } from '../lib/ui';
import { z } from '../lib/theme';

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
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {offline && (
        <div role="status" style={{ background: 'var(--vd-warn-bg)', color: 'var(--vd-warn-fg)', textAlign: 'center', fontSize: 12.5, fontWeight: 700, padding: '8px 12px' }}>
          You’re offline — consults and reviews need a connection.
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
      {updateReady && (
        <div
          {...pressProps(() => location.reload(), 'Reload to apply update')}
          style={{
            position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: z.toast,
            background: '#241B45', color: 'var(--vd-ink-on-brand)', padding: '10px 18px', borderRadius: 99,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 10px 26px rgba(12,20,60,.4)',
          }}
        >
          Update ready — tap to reload
        </div>
      )}
    </div>
  );
}
