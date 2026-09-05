import { useEffect, useState } from 'react';
import { pressProps } from '../lib/ui';
import { ink, media, radius, type, z } from '../lib/theme';

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
      <style>{`.vd-toast{bottom:calc(88px + env(safe-area-inset-bottom))}
${media.tabletUp}{.vd-toast{bottom:24px}}`}</style>
      {offline && (
        <div
          role="status"
          className="vd-glass-thin"
          style={{
            minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--vd-warn-bg)', color: 'var(--vd-warn-fg)', textAlign: 'center',
            border: 'none', borderRadius: 0, boxShadow: 'none',
            ...type.footnote, fontWeight: 700, padding: '8px 12px',
          }}
        >
          You’re offline — consults and reviews need a connection.
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
      {updateReady && (
        <div
          {...pressProps(() => location.reload(), 'Reload to apply update')}
          className="vd-toast"
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: z.toast,
            background: 'var(--vd-surface-card)', color: ink.primary, padding: '12px 18px',
            borderRadius: radius.pill, border: '1px solid var(--vd-border)',
            ...type.subhead, cursor: 'pointer', boxShadow: 'var(--vd-elev-5)',
          }}
        >
          Update ready — tap to reload
        </div>
      )}
    </div>
  );
}
