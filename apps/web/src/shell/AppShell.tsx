import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { pressProps } from '../lib/ui';
import s from './AppShell.module.css';

// AppShell: chrome-less full-viewport wrapper + update toast. Renders the
// active module edge-to-edge; each module owns its responsive layout.
// Module switching is URL-based (/patient, /doctor), not tab-based.

export function AppShell({ children }: { children: React.ReactNode }) {
  const [updateReady, setUpdateReady] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  // A mistyped or outdated link says so instead of silently landing you home (UX-27).
  const { key, state } = useLocation();
  const notFound = (state as { notFound?: string } | null)?.notFound;
  const [showNotFound, setShowNotFound] = useState<string | null>(null);
  useEffect(() => {
    if (!notFound) return;
    setShowNotFound(notFound);
    const t = setTimeout(() => setShowNotFound(null), 6000);
    return () => clearTimeout(t);
  }, [notFound, key]);

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
          You’re offline — anything you do now stays on this device and is sent
          to your doctor when the connection is back.
        </div>
      )}
      {showNotFound && (
        <div role="status" className={`vd-glass-thin ${s.offline}`}>
          “{showNotFound}” doesn’t exist — here’s your home.
        </div>
      )}
      {/* First tab stop on every route: six chrome stops used to precede the
          page's own content, with no way past them (QA-17). */}
      <a href="#vd-main" className={s.skip}>Skip to content</a>
      <main id="vd-main" tabIndex={-1} className={s.main}>{children}</main>
      {updateReady && (
        <div {...pressProps(() => location.reload(), 'Reload to apply update')} className={s.toast}>
          Update ready — tap to reload
        </div>
      )}
    </div>
  );
}
