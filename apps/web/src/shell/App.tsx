import { Suspense, useEffect, useState } from 'react';
import { MiraPresence } from '../lib/ui';
import { resolveTenantSlug, tenantDisplayName } from '../lib/core';
import { setDocumentTitle } from '../lib/platform';
import { AppShell } from './AppShell';
import { AuthProvider, useAuth } from './auth';
import { SignedInRoutes, SignedOutRoutes } from './routes';
import { gradients, radius } from '../lib/theme';

export function App() {
  return (
    <AuthProvider>
      <GatedApp />
    </AuthProvider>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ flex: 1, minHeight: '100dvh', background: gradients.app, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 40 }}>
      <MiraPresence size={96} />
      {[220, 160].map(w => (
        <div key={w} style={{ width: w, maxWidth: '70%', height: 14, borderRadius: radius.pill, background: 'var(--vd-surface-card)', animation: 'vd-shimmer calc(var(--vd-dur-5) * 4) var(--vd-ease-spring) infinite' }} />
      ))}
    </div>
  );
}

function GatedApp() {
  const { user, ready } = useAuth();
  const [tenantName, setTenantName] = useState('Virtual Doctor');

  useEffect(() => {
    const slug = resolveTenantSlug(location.hostname, location.search);
    const name = tenantDisplayName(slug);
    setTenantName(name);
    setDocumentTitle(name);
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
