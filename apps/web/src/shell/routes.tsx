// Route trees: signed-out (login only) and signed-in (role landing +
// patient / doctor modules). Rendered inside Suspense by App.
import { lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth, type Role } from './auth';
import { LoginPage } from '../modules/login/LoginPage';

const importPatient = () => import('../modules/patient/PatientApp');
const importDoctor = () => import('../modules/doctor/DoctorApp');

const PatientApp = lazy(() => importPatient().then(m => ({ default: m.PatientApp })));
const DoctorApp = lazy(() => importDoctor().then(m => ({ default: m.DoctorApp })));

/** Warm the chunk a known role is about to land on, so the first route
 *  transition after the session gate resolves has nothing left to download.
 *  With no role yet — the login screen — both are warmed: together they are
 *  about 31 kB gzipped, cheaper than guessing wrong and making the winner wait. */
export function prefetchModule(role?: Role): void {
  const wanted = role === 'doctor' ? [importDoctor]
    : role === 'patient' ? [importPatient]
    : [importPatient, importDoctor];
  for (const load of wanted) {
    void load().catch(() => {
      /* offline, or the chunk is gone after a deploy — the route will retry */
    });
  }
}

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
