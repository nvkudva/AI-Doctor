// Doctor profile — the patient profile's layout with practice figures in place
// of vitals (DESIGN §11.7).
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AppHeader, Card, NotifyButton, ProfileSection, SignOutButton, StatRow, SwitchRow, ThemeToggle, profile,
} from '../../../lib/ui';
import { useAuth } from '../../../shell/auth';
import { isReviewable, slaCountdown } from '../../../lib/core';
import { useClinic } from '../../../store';
import { seedDoctor } from '../../../store/seeds';
import s from './ProfileScreen.module.css';

export function ProfileScreen({ tenantName, onSelectCase }: {
  /** The hospital the app is running as, so the practice block cannot name a
   *  different employer from every header in the product (D29). */
  tenantName: string;
  onSelectCase: (id: string) => void;
}) {
  const { user, signOut, viewAs, setViewAs } = useAuth();
  const clinic = useClinic();
  const nav = useNavigate();
  const [notifs, setNotifs] = useState(false);
  const [onDuty, setOnDuty] = useState(true);
  const week = Date.now() - 7 * 86400000;
  const awaiting = clinic.queue.filter(c => isReviewable(c.status)).length;
  const decided = clinic.queue.filter(c => c.reviewedAt && c.reviewedAt >= week && c.submittedAt);
  const breached = decided.filter(c => slaCountdown(c.submittedAt!).breached).length;
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
      {/* Work the doctor can act on, not a marketplace scorecard. */}
      <StatRow items={[
        { label: 'Awaiting your review', value: String(awaiting), tone: awaiting ? 'var(--vd-warn-fg)' : undefined },
        { label: 'Median decision', value: medianDecision(decided) },
        { label: 'Breached this week', value: String(breached), tone: breached ? 'var(--vd-bad-fg)' : undefined },
      ]} />

      <ProfileSection>Practice</ProfileSection>
      <div className={profile.list}>
        <Card level={1} pad={12} className={s.card}>
          <Field label="Specialty" value={seedDoctor.specialty} />
          <Field label="Registration" value={seedDoctor.registration} />
          <Field label="Hospital" value={tenantName} />
          <Field label="Languages" value={seedDoctor.languages} />
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

      <SignOutButton onClick={signOut} />
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

// The middle half of this week's decisions, in whole minutes. "—" until there
// is something to take a median of.
function medianDecision(decided: { submittedAt?: number; reviewedAt?: number }[]): string {
  const spans = decided
    .map(c => (c.reviewedAt || 0) - (c.submittedAt || 0))
    .filter(ms => ms > 0)
    .sort((a, b) => a - b);
  if (!spans.length) return '—';
  const mid = spans[Math.floor(spans.length / 2)];
  const mins = Math.round(mid / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
