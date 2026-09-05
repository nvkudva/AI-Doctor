// Doctor profile — the patient profile's layout with practice figures in place
// of vitals (DESIGN §11.7).
import { useNavigate } from 'react-router';
import {
  AppHeader, Card, MenuRow, NotifyButton, ProfileSection, SignOutButton, StatRow, ThemeToggle,
  bottomBarInset, profileCss,
} from '../../../lib/ui';
import { ink, radius, space, type } from '../../../lib/theme';
import { useAuth } from '../../../shell/auth';
import { useClinic } from '../../../store';
import { seedDoctor } from '../../../store/seeds';
import { useState } from 'react';

export function ProfileScreen({ onSelectCase }: { onSelectCase: (id: string) => void }) {
  const { user, signOut } = useAuth();
  const clinic = useClinic();
  const nav = useNavigate();
  const [notifs, setNotifs] = useState(false);
  const reviewed = clinic.queue.filter(c => c.reviewedAt).length;
  return (
    <div className="vd-scroll vd-profile" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px 20px ${bottomBarInset}` }}>
      <style>{profileCss}</style>

      <AppHeader

        title=""
        identity={{ name: user?.name || 'Dr. Sara Whitfield', email: user?.email || 'sara.whitfield@example.com' }}
        actions={(
          <>
            <SignOutButton onClick={signOut} />
            <ThemeToggle />
            <NotifyButton
              notices={clinic.notices}
              open={notifs}
              onToggle={() => setNotifs(o => !o)}
              onClose={() => setNotifs(false)}
              onSelectCase={onSelectCase}
              onDismiss={clinic.dismissNotice}
            />
          </>
        )}
        style={{ marginBottom: space[4] }}
      />

      <StatRow items={[
        { label: 'Patients', value: seedDoctor.patients },
        { label: 'Years', value: seedDoctor.years },
        { label: 'Rating', value: seedDoctor.rating, tone: 'var(--vd-ok-fg)' },
      ]} />

      <ProfileSection>Practice</ProfileSection>
      <div className="vd-profile-list">
        <Card level={1} pad={12} style={{ marginBottom: 8 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: space[2], marginBottom: space[3],
            padding: '6px 12px', background: 'var(--vd-ok-bg)', borderRadius: radius.pill,
            ...type.caption, color: 'var(--vd-ok-fg)',
          }}>
            On duty · accepting reviews
          </div>
          <Field label="Specialty" value={seedDoctor.specialty} />
          <Field label="Registration" value={seedDoctor.registration} />
          <Field label="Hospital" value={seedDoctor.hospital} />
          <Field label="Languages" value={seedDoctor.languages} />
          <Field label="Cases reviewed here" value={String(reviewed)} />
        </Card>
      </div>

      <ProfileSection>Settings</ProfileSection>
      <Card level={1} pad={6} className="vd-profile-list">
        <MenuRow icon="person" onClick={() => nav('/patient')}>Patient view</MenuRow>
        <MenuRow icon="key" disabled detail="Managed by your Google account">Change password</MenuRow>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, minHeight: 32, alignItems: 'center' }}>
      <span style={{ ...type.footnote, color: ink.secondary }}>{label}</span>
      <span style={{ ...type.footnote, fontWeight: 700, color: ink.primary, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
