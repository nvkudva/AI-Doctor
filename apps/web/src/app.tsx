import { Suspense, lazy, useEffect, useState } from 'react';
import { MiraPresence } from '@vd/ui';
import { resolveTenantSlug, tenantDisplayName } from '@vd/core';
import { setDocumentTitle } from '@vd/platform';
import { AppShell } from './shell/AppShell';
import { AuthProvider, LoginPage, go, useAuth } from './shell/auth';
import { ink } from '@vd/theme';
import { moduleForPath, type Module } from './shell/routing';

const PatientApp = lazy(() =>
  import('./modules/patient/PatientApp').then(m => ({ default: m.PatientApp })),
);
const DoctorApp = lazy(() =>
  import('./modules/doctor/DoctorApp').then(m => ({ default: m.DoctorApp })),
);

export function App() {
  return (
    <AuthProvider>
      <GatedApp />
    </AuthProvider>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 40 }}>
      <MiraPresence size={96} />
      {[220, 160].map(w => (
        <div key={w} style={{ width: w, maxWidth: '70%', height: 14, borderRadius: 99, background: 'var(--vd-surface-card)', animation: 'vd-shimmer 1.6s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

function GatedApp() {
  const { user, ready } = useAuth();
  const [tenantName, setTenantName] = useState('Virtual Doctor');
  // Any signed-in user may use either view; the URL owns the module.
  const [module, setModule] = useState<Module>(() => moduleForPath(location.pathname));

  useEffect(() => {
    const slug = resolveTenantSlug(location.hostname, location.search);
    const name = tenantDisplayName(slug);
    setTenantName(name);
    setDocumentTitle(name);
    const onPop = () => setModule(moduleForPath(location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    // First landing only: default to the user's home view, preserving any
    // deep link (path + query) they arrived with.
    if (location.pathname === '/') {
      const target = user.role === 'doctor' ? '/doctor' : '/patient';
      go(target + location.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.role]);

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
        <LoginPage hospitalName={tenantName} />
      </AppShell>
    );
  }

  const active: Module = module;

  return (
    <AppShell>
      <Suspense fallback={<LoadingSkeleton />}>
        {active === 'doctor' ? <DoctorApp tenantName={tenantName} /> : <PatientApp />}
      </Suspense>
    </AppShell>
  );
}
