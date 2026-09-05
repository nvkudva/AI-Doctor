// Route trees: signed-out (login only) and signed-in (role landing +
// patient / doctor modules). Rendered inside Suspense by App.
import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth';
import { LoginPage } from '../modules/login/LoginPage';

const PatientApp = lazy(() =>
  import('../modules/patient/PatientApp').then(m => ({ default: m.PatientApp })),
);
const DoctorApp = lazy(() =>
  import('../modules/doctor/DoctorApp').then(m => ({ default: m.DoctorApp })),
);

// First landing only: default to the user's home view, preserving any
// deep link (path + query) they arrived with.
function RoleLanding() {
  const { user } = useAuth();
  const { search } = useLocation();
  return <Navigate to={(user?.role === 'doctor' ? '/doctor' : '/patient') + search} replace />;
}

export function SignedOutRoutes({ tenantName }: { tenantName: string }) {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage hospitalName={tenantName} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export function SignedInRoutes({ tenantName }: { tenantName: string }) {
  return (
    <Routes>
      <Route path="/" element={<RoleLanding />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/patient/*" element={<PatientApp />} />
      <Route path="/doctor/*" element={<DoctorApp tenantName={tenantName} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
