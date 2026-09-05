// Patient module: login → home → consult → recommendation → profile.
// Owns the consult session; shares lifecycle + records via the clinic store.
// Shell = full-bleed on mobile, sidebar + content column at ≥800 (DESIGN §10).
import { ClinicProvider } from '../../store';
import { seedConsults, seedQueue, seedRx } from '../../store/seeds';
import { PatientFlow } from './components/PatientFlow';
import s from './PatientApp.module.css';

export function PatientApp() {
  return (
    <ClinicProvider seedQueue={seedQueue} seedConsults={seedConsults} seedRx={seedRx}>
      <div className={s.ground}>
        <div className={s.shell}>
          <PatientFlow />
        </div>
      </div>
    </ClinicProvider>
  );
}
