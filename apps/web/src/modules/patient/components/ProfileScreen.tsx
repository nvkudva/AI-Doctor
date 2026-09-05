// Patient profile: identity in the header, vitals, prescriptions, coverage,
// then settings. The doctor profile mirrors this layout (DESIGN §11.7).
import { useNavigate } from 'react-router';
import {
  AppHeader, Card, EmptyState, MenuRow, ProfileSection, SignOutButton, StatRow, ThemeToggle, profile,
} from '../../../lib/ui';
import { useAuth } from '../../../shell/auth';
import type { UserRx } from '../../../store';
import { PatientNotify } from './PatientNotify';
import s from './ProfileScreen.module.css';

export function ProfileScreen({ prescriptions }: { prescriptions: UserRx[] }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className={profile.screen}>
      <AppHeader
        title=""
        identity={{ name: user?.name || 'Alex Kumar', email: user?.email || 'alex.kumar@gmail.com' }}
        actions={<><SignOutButton onClick={signOut} /><ThemeToggle /><PatientNotify /></>}
        className={s.header}
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
          <div className={profile.list}>
            {prescriptions.map((p, i) => (
              <Card key={i} level={1} pad="13px 15px" className={s.rx}>
                <div className={s.rxName}>{p.name}</div>
                <div className={s.rxMeta}>{p.detail} · {p.date}</div>
              </Card>
            ))}
          </div>
        )}

      <ProfileSection>Coverage &amp; payment</ProfileSection>
      <div className={profile.pair}>
        <Card level={1} pad={12}>
          <div className={s.tileLabel}>Insurance</div>
          <div className={s.tileValue}>Star Health · AX-48291</div>
          <div className={s.tileMeta}>Family Floater · ₹500 copay</div>
        </Card>
        <Card level={1} pad={12}>
          <div className={s.tileLabel}>Payment</div>
          <div className={s.tileValue}>•••• 4291</div>
          <div className={s.tileMeta}>HDFC · Exp 09/28</div>
        </Card>
      </div>

      <ProfileSection>Settings</ProfileSection>
      <Card level={1} pad={6} className={profile.list}>
        <MenuRow icon="person" onClick={() => nav('/doctor')}>Doctor view</MenuRow>
        <MenuRow icon="key" disabled detail="Managed by your Google account">Change password</MenuRow>
      </Card>
    </div>
  );
}
