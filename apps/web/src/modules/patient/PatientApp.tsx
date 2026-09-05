// Patient module: login → home → consult → recommendation → profile.
// Owns the consult session; shares lifecycle + records via the clinic store.
// Shell = full-bleed on mobile, sidebar + content column at ≥800 (DESIGN §10).
import { gradients, media } from '../../lib/theme';
import { ClinicProvider } from '../../store';
import { seedConsults, seedQueue, seedRx } from '../../store/seeds';
import { PatientFlow } from './components/PatientFlow';

export function PatientApp() {
  return (
    <ClinicProvider seedQueue={seedQueue} seedConsults={seedConsults} seedRx={seedRx}>
      <div style={{ minHeight: '100dvh', background: gradients.app }}>
        <style>{`
          ${media.tabletUp}{.vd-patient-shell{max-width:1000px;margin:0 auto;gap:20px;padding:16px 0 16px 16px}}
          ${media.desktopUp}{.vd-patient-shell{max-width:1360px;gap:32px;padding:20px 0 20px 20px}}
        `}</style>
        <div className="vd-patient-shell" style={{ position: 'relative', width: '100%', height: '100dvh', display: 'flex', overflow: 'hidden' }}>
          <PatientFlow />
        </div>
      </div>
    </ClinicProvider>
  );
}
