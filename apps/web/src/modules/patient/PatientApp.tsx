// Patient module: login → home → consult → recommendation → profile.
// Owns the consult session; shares lifecycle + records via the clinic store.
// Shell = full-bleed on mobile, sidebar + content column at ≥800 (DESIGN §10).
import { ClinicProvider } from '../../store';
import { demoPatientProfile, seedConsults, seedQueue, seedRx } from '../../store/seeds';
import { useAuth } from '../../shell/auth';
import { PatientFlow } from './components/PatientFlow';
import s from './PatientApp.module.css';

export function PatientApp() {
  const { user } = useAuth();
  // Only the seeded demo account has clinical facts on file; anyone else starts
  // blank and fills their own profile in (UX-25).
  const seedProfile = user?.id === demoPatientProfile.authId
    ? { age: demoPatientProfile.age, blood: demoPatientProfile.blood, allergies: demoPatientProfile.allergies.join(', ') }
    : { age: '', blood: '', allergies: '' };
  return (
    <ClinicProvider
      seedQueue={seedQueue}
      seedConsults={seedConsults}
      seedRx={seedRx}
      seedProfile={seedProfile}
    >
      <div className={s.ground}>
        <div className={s.shell}>
          <PatientFlow />
        </div>
      </div>
    </ClinicProvider>
  );
}
