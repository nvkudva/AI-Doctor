import { Suspense, useEffect, useState } from 'react';
import { MiraPresence } from '../lib/ui';
import { resolveTenantSlug, tenantDisplayName } from '../lib/core';
import { setDocumentTitle } from '../lib/platform';
import { hasSupabase } from '../lib/api/env';
import { AppShell } from './AppShell';
import { AuthProvider, useAuth } from './auth';
import { prefetchModule, SignedInRoutes, SignedOutRoutes } from './routes';
import s from './App.module.css';

export function App() {
  return (
    <AuthProvider>
      <GatedApp />
    </AuthProvider>
  );
}

function LoadingSkeleton() {
  return (
    <div className={s.loading}>
      <MiraPresence size={96} />
      {[220, 160].map(w => <div key={w} className={s.bar} style={{ width: w }} />)}
    </div>
  );
}

function GatedApp() {
  const { user, ready } = useAuth();
  const [tenantName, setTenantName] = useState('AI Doctor');

  useEffect(() => {
    const slug = resolveTenantSlug(location.hostname, location.search);
    // The hostname is only a guess at the tenant. Where there is a backend, the
    // hospital's own name is the answer — a deploy on a hosting subdomain would
    // otherwise title itself after the subdomain ("Ai Doctor 8ai").
    const fallback = tenantDisplayName(slug);
    setTenantName(fallback);
    setDocumentTitle(fallback);
    if (!hasSupabase()) return;
    let live = true;
    // Imported here rather than at the top: lib/api/client pulls the Supabase
    // SDK, and the tenant's display name is not worth putting it on the
    // critical path — the hostname guess is already on screen.
    import('../lib/api/client')
      .then(({ resolveHospitalName }) => resolveHospitalName(slug))
      .then((name) => {
        if (!live || !name) return;
        setTenantName(name);
        setDocumentTitle(name);
      })
      .catch(() => { /* the hostname guess stands */ });
    return () => { live = false; };
  }, []);

  // A restored session names the role before the session gate resolves, so that
  // module downloads during the wait. Signed out, the role is unknowable until
  // the tap, so both are warmed while the login screen sits idle.
  const role = user?.role;
  useEffect(() => {
    const warm = () => prefetchModule(role);
    const idle = window.requestIdleCallback?.(warm);
    if (idle === undefined) { const t = setTimeout(warm, 200); return () => clearTimeout(t); }
    return () => window.cancelIdleCallback?.(idle);
  }, [role]);

  if (!ready) {
    return (
      <AppShell>
        <LoadingSkeleton />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <Suspense fallback={<LoadingSkeleton />}>
          <SignedOutRoutes tenantName={tenantName} />
        </Suspense>
      </AppShell>
    );
  }

  // Any signed-in user may use either view; the URL owns the module.
  return (
    <AppShell>
      <Suspense fallback={<LoadingSkeleton />}>
        <SignedInRoutes tenantName={tenantName} />
      </Suspense>
    </AppShell>
  );
}
