import { Suspense, useEffect, useState } from 'react';
import { MiraPresence } from '../lib/ui';
import { resolveTenantSlug, tenantDisplayName } from '../lib/core';
import { setDocumentTitle } from '../lib/platform';
import { hasSupabase, resolveHospitalName } from '../lib/api';
import { AppShell } from './AppShell';
import { AuthProvider, useAuth } from './auth';
import { SignedInRoutes, SignedOutRoutes } from './routes';
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
    resolveHospitalName(slug)
      .then((name) => {
        if (!live || !name) return;
        setTenantName(name);
        setDocumentTitle(name);
      })
      .catch(() => { /* the hostname guess stands */ });
    return () => { live = false; };
  }, []);

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
