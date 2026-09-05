// Single owner of the module type + URL ↔ state sync helpers. Patient
// screens and the doctor's selected case live in the URL so refresh,
// back/forward, and deep links keep working.

export type Module = 'patient' | 'doctor';

export function moduleForPath(pathname: string): Module {
  return pathname.startsWith('/doctor') ? 'doctor' : 'patient';
}

export type PatientScreen = 'home' | 'consult' | 'recommendation' | 'records';
export type RecordsTab = 'history' | 'labs' | 'profile';

const SCREENS: PatientScreen[] = ['home', 'consult', 'recommendation', 'records'];
const TABS: RecordsTab[] = ['history', 'labs', 'profile'];

export function readPatientRoute(): { screen: PatientScreen; tab: RecordsTab } {
  try {
    const q = new URLSearchParams(location.search);
    const s = q.get('s');
    const t = q.get('tab');
    return {
      screen: SCREENS.includes(s as PatientScreen) ? (s as PatientScreen) : 'home',
      tab: TABS.includes(t as RecordsTab) ? (t as RecordsTab) : 'history',
    };
  } catch {
    return { screen: 'home', tab: 'history' };
  }
}

export function writePatientRoute(screen: PatientScreen, tab: RecordsTab) {
  try {
    const q = new URLSearchParams(location.search);
    q.set('s', screen);
    if (screen === 'records') q.set('tab', tab);
    else q.delete('tab');
    history.replaceState(null, '', `${location.pathname}?${q.toString()}`);
  } catch { /* private mode */ }
}

export function readCaseParam(): string | null {
  try {
    return new URLSearchParams(location.search).get('case');
  } catch {
    return null;
  }
}

export function writeCaseParam(id: string | null) {
  try {
    const q = new URLSearchParams(location.search);
    if (id) q.set('case', id);
    else q.delete('case');
    const s = q.toString();
    history.replaceState(null, '', s ? `${location.pathname}?${s}` : location.pathname);
  } catch { /* private mode */ }
}
