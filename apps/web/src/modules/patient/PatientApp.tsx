// Patient module: login → home → consult → recommendation → profile.
// Owns the consult session; shares lifecycle + records via the clinic store.
import { gradients, media } from '../../lib/theme';
import { ClinicProvider } from '../../store';
import { seedConsults, seedQueue, seedRx } from '../../store/seeds';
import { PatientFlow } from './components/PatientFlow';

export function PatientApp() {
  return (
    <ClinicProvider seedQueue={seedQueue} seedConsults={seedConsults} seedRx={seedRx}>
      <div style={{ minHeight: '100dvh', background: gradients.app, display: 'flex', justifyContent: 'center' }}>
        <style>{`${media.tabletUp}{.vd-patient-shell{width:min(1120px,100%)!important}}`}</style>
        <div className="vd-patient-shell" style={{ position: 'relative', width: 'min(560px, 100%)', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PatientFlow />
        </div>
      </div>
    </ClinicProvider>
  );
}
