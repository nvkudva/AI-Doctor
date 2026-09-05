// Route trees: signed-out (login only) and signed-in (role landing +
// patient / doctor modules). Rendered inside Suspense by App.
import { lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth, type Role } from './auth';
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

// Unknown path: land the user home, but say the destination did not exist.
function NotFound() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  return (
    <Navigate
      to={user?.role === 'doctor' ? '/doctor' : '/patient'}
      replace
      state={{ notFound: pathname }}
    />
  );
}

export function SignedOutRoutes({ tenantName }: { tenantName: string }) {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage hospitalName={tenantName} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

// Module access is gated by role: a patient session must never reach the
// review desk (another patient's record + working Approve controls), and a
// doctor session has no patient module of its own.
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'doctor' ? '/doctor' : '/patient'} replace />;
  return <>{children}</>;
}

export function SignedInRoutes({ tenantName }: { tenantName: string }) {
  return (
    <Routes>
      <Route path="/" element={<RoleLanding />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        path="/patient/*"
        element={<RequireRole role="patient"><PatientApp /></RequireRole>}
      />
      <Route
        path="/doctor/*"
        element={<RequireRole role="doctor"><DoctorApp tenantName={tenantName} /></RequireRole>}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
