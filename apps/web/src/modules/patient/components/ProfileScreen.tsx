// Patient profile: identity in the header, vitals, prescriptions, coverage,
// then settings. The doctor profile mirrors this layout (DESIGN §11.7).
import { useNavigate } from 'react-router';
import {
  AppHeader, Card, EmptyState, MenuRow, ProfileSection, SignOutButton, StatRow, ThemeToggle,
  bottomBarInset, profileCss,
} from '../../../lib/ui';
import { ink, space, type } from '../../../lib/theme';
import { useAuth } from '../../../shell/auth';
import type { UserRx } from '../../../store';
import { PatientNotify } from './PatientNotify';

export function ProfileScreen({ prescriptions }: { prescriptions: UserRx[] }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="vd-scroll vd-profile" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 20px ${bottomBarInset}` }}>
      <style>{profileCss}</style>

      <AppHeader

        title=""
        identity={{ name: user?.name || 'Alex Kumar', email: user?.email || 'alex.kumar@gmail.com' }}
        actions={<><SignOutButton onClick={signOut} /><ThemeToggle /><PatientNotify /></>}
        style={{ marginBottom: space[4] }}
      />

      <StatRow items={[
        { label: 'Age', value: '34' },
        { label: 'Blood', value: 'O+' },
        { label: 'Allergy', value: 'Penicillin', tone: 'var(--vd-bad-fg)' },
      ]} />

      <ProfileSection>Prescriptions</ProfileSection>
      {prescriptions.length === 0
        ? <EmptyState icon="doc" title="No prescriptions on file" body="Approved prescriptions are saved here." />
        : (
          <div className="vd-profile-list">
            {prescriptions.map((p, i) => (
              <Card key={i} level={1} pad="13px 15px" style={{ marginBottom: 8 }}>
                <div style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>{p.name}</div>
                <div style={{ ...type.footnote, color: ink.secondary }}>{p.detail} · {p.date}</div>
              </Card>
            ))}
          </div>
        )}

      <ProfileSection>Coverage &amp; payment</ProfileSection>
      <div className="vd-profile-pair">
        <Card level={1} pad={12}>
          <div style={{ ...type.micro, color: ink.secondary }}>Insurance</div>
          <div style={{ ...type.callout, fontWeight: 700, color: ink.primary, marginTop: 4 }}>Star Health · AX-48291</div>
          <div style={{ ...type.footnote, color: ink.secondary, marginTop: 2 }}>Family Floater · ₹500 copay</div>
        </Card>
        <Card level={1} pad={12}>
          <div style={{ ...type.micro, color: ink.secondary }}>Payment</div>
          <div style={{ ...type.callout, fontWeight: 700, color: ink.primary, marginTop: 4 }}>•••• 4291</div>
          <div style={{ ...type.footnote, color: ink.secondary, marginTop: 2 }}>HDFC · Exp 09/28</div>
        </Card>
      </div>

      <ProfileSection>Settings</ProfileSection>
      <Card level={1} pad={6} className="vd-profile-list">
        <MenuRow icon="person" onClick={() => nav('/doctor')}>Doctor view</MenuRow>
        <MenuRow icon="key" disabled detail="Managed by your Google account">Change password</MenuRow>
      </Card>
    </div>
  );
}
