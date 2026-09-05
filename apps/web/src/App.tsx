import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { MiraPresence } from './lib/ui';
import { resolveTenantSlug, tenantDisplayName } from './lib/core';
import { setDocumentTitle } from './lib/platform';
import { AppShell } from './shell/AppShell';
import { AuthProvider, useAuth } from './shell/auth';
import { LoginPage } from './modules/login/LoginPage';
import { ink } from './lib/theme';

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

// First landing only: default to the user's home view, preserving any
// deep link (path + query) they arrived with.
function RoleLanding() {
  const { user } = useAuth();
  const { search } = useLocation();
  return <Navigate to={(user?.role === 'doctor' ? '/doctor' : '/patient') + search} replace />;
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
          <Routes>
            <Route path="/login" element={<LoginPage hospitalName={tenantName} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    );
  }

  // Any signed-in user may use either view; the URL owns the module.
  return (
    <AppShell>
      <Suspense fallback={<LoadingSkeleton />}>
        <Routes>
          <Route path="/" element={<RoleLanding />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/patient/*" element={<PatientApp />} />
          <Route path="/doctor/*" element={<DoctorApp tenantName={tenantName} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
