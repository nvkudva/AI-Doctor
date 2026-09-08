import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { pressProps } from '../lib/ui';
import s from './AppShell.module.css';

// AppShell: chrome-less full-viewport wrapper + update toast. Renders the
// active module edge-to-edge; each module owns its responsive layout.
// Module switching is URL-based (/patient, /doctor), not tab-based.

type UpdateSW = (reload?: boolean) => Promise<void>;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [applyUpdate, setApplyUpdate] = useState<UpdateSW | null>(null);
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
    // Gated SW update: never silently reload mid-consult. main.tsx hands us
    // registerSW's updateSW — calling it is what promotes the waiting worker.
    const onSW = (e: Event) => {
      const fn = (e as CustomEvent<UpdateSW>).detail;
      if (typeof fn === 'function') setApplyUpdate(() => fn);
    };
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
          You’re offline — the app is open but nothing new can be sent or
          fetched. Reconnect to reach your doctor.
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
      {applyUpdate && (
        <div {...pressProps(() => void applyUpdate(true), 'Reload to apply update')} className={s.toast}>
          Update ready — tap to reload
        </div>
      )}
    </div>
  );
}
