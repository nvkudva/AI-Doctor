// Doctor profile — the patient profile's layout with practice figures in place
// of vitals (DESIGN §11.7).
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AppHeader, Card, NotifyButton, ProfileSection, SignOutButton, StatRow, SwitchRow, ThemeToggle, profile,
} from '../../../lib/ui';
import { useAuth } from '../../../shell/auth';
import { useClinic } from '../../../store';
import { seedDoctor } from '../../../store/seeds';
import s from './ProfileScreen.module.css';

export function ProfileScreen({ onSelectCase }: { onSelectCase: (id: string) => void }) {
  const { user, signOut, viewAs, setViewAs } = useAuth();
  const clinic = useClinic();
  const nav = useNavigate();
  const [notifs, setNotifs] = useState(false);
  const [onDuty, setOnDuty] = useState(true);
  const reviewed = clinic.queue.filter(c => c.reviewedAt).length;
  return (
    <>
      {/* The header sits outside the scrolling body and on the desk's own
          gutters, so its actions line up with Home, Appointments and Reviews
          rather than 24px lower on the one screen that scrolled them. */}
      <AppHeader
        title={user?.name || 'Dr. Sara Whitfield'}
        subtitle={<span className={profile.email}>{user?.email || 'sara.whitfield@example.com'}</span>}
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
        className={s.header}
      />

      <div className={profile.screen}>
      <StatRow items={[
        { label: 'Patients', value: seedDoctor.patients },
        { label: 'Years', value: seedDoctor.years },
        { label: 'Rating', value: seedDoctor.rating, tone: 'var(--vd-ok-fg)' },
      ]} />

      <ProfileSection>Practice</ProfileSection>
      <div className={profile.list}>
        <Card level={1} pad={12} className={s.card}>
          <Field label="Specialty" value={seedDoctor.specialty} />
          <Field label="Registration" value={seedDoctor.registration} />
          <Field label="Hospital" value={seedDoctor.hospital} />
          <Field label="Languages" value={seedDoctor.languages} />
          <Field label="Cases reviewed here" value={String(reviewed)} />
        </Card>
      </div>

      <ProfileSection>Settings</ProfileSection>
      <Card level={1} pad={6} className={profile.list}>
        {/* Every row here has a control. Going off duty is the one setting a
            clinician actually needs and it was a static green pill in the
            Practice card (DESIGN-REVIEW D16). */}
        <SwitchRow
          icon="check"
          checked={onDuty}
          detail="Accepting new reviews"
          onChange={setOnDuty}
        >
          On duty
        </SwitchRow>
        <SwitchRow
          icon="person"
          checked={viewAs === 'patient'}
          detail="See the app as a patient does"
          onChange={(on) => { setViewAs(on ? 'patient' : null); nav(on ? '/patient' : '/doctor'); }}
        >
          Patient view
        </SwitchRow>
      </Card>

      {/* Not a row: it is not tappable, so it must not look like the two that
          are. A row without a control gets no hover or press state. */}
      <ProfileSection>Account</ProfileSection>
      <Card level={1} pad="14px 16px" className={profile.list}>
        <div className={s.account}>
          Your password is managed by your Google account.
        </div>
      </Card>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.field}>
      <span className={s.fieldLabel}>{label}</span>
      <span className={s.fieldValue}>{value}</span>
    </div>
  );
}
