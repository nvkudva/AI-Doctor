// Patient profile: identity in the header, vitals, prescriptions, coverage,
// then settings. The doctor profile mirrors this layout (DESIGN §11.7).
import { useState } from 'react';
import {
  AppHeader, Button, Card, EmptyState, Icon, MenuRow, profile, ProfileSection, Sheet, SignOutButton, StatRow, ThemeToggle,
} from '../../../lib/ui';
import { useAuth } from '../../../shell/auth';
import { useClinic } from '../../../store';
import type { HealthProfile, UserRx } from '../../../store';
import { PatientNotify } from './PatientNotify';
import s from './ProfileScreen.module.css';

export function ProfileScreen({ prescriptions }: { prescriptions: UserRx[] }) {
  const drugs = prescriptions.filter(x => !!x.dosage?.trim());
  const todo = prescriptions.filter(x => !x.dosage?.trim());
  const { user, signOut } = useAuth();
  const clinic = useClinic();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HealthProfile>(clinic.profile);
  const p = clinic.profile;
  const open = () => { setDraft(clinic.profile); setEditing(true); };
  return (
    <div className={profile.screen}>
      <AppHeader
        title={user?.name || 'Alex Kumar'}
        subtitle={<span className={profile.email}>{user?.email || 'alex.kumar@gmail.com'}</span>}
        actions={<><SignOutButton onClick={signOut} /><ThemeToggle /><PatientNotify /></>}
        className={s.header}
      />

      <StatRow items={[
        { label: 'Age', value: p.age || 'Not set' },
        { label: 'Blood', value: p.blood || 'Not set' },
        { label: 'Allergy', value: p.allergies || 'None on file', tone: p.allergies ? 'var(--vd-bad-fg)' : undefined },
      ]} />
      <div className={s.editRow}>
        <Button variant="tertiary" onClick={open}>Edit health profile</Button>
      </div>

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Your health profile"
        label="Edit your health profile"
        footer={(
          <Button
            variant="primary"
            fullWidth
            onClick={() => { clinic.setProfile(draft); setEditing(false); }}
          >
            Save
          </Button>
        )}
      >
        <div className={s.form}>
          <div className={s.formNote}>Dr. Mira uses these in every consult. Changes apply to future consults.</div>
          <Field label="Age" value={draft.age} onChange={v => setDraft(d => ({ ...d, age: v }))} placeholder="e.g. 34" />
          <Field label="Blood group" value={draft.blood} onChange={v => setDraft(d => ({ ...d, blood: v }))} placeholder="e.g. O+" />
          <Field
            label="Allergies"
            value={draft.allergies}
            onChange={v => setDraft(d => ({ ...d, allergies: v }))}
            placeholder="Comma separated, or leave blank"
          />
        </div>
      </Sheet>

      {/* A plan item is a drug only when it carries a dosage. Listing a booked
          blood test or a diet plan under "Prescriptions" was simply wrong.
          Side by side from 800 up, stacked on a phone. */}
      <div className={profile.columns}>
        <div className={profile.column}>
          <ProfileSection>Prescriptions</ProfileSection>
          {drugs.length === 0
            ? <EmptyState icon="pill" title="No prescriptions on file" body="Approved prescriptions are saved here." />
            : (
              <div className={profile.list}>
                {drugs.map((p, i) => (
                  <Card key={i} level={1} pad="13px 15px" className={s.rx}>
                    <span className={s.rxIcon}><Icon name="pill" size={16} /></span>
                    <div className={s.rxBody}>
                      <div className={s.rxName}>{p.name}</div>
                      <div className={s.rxMeta}>{p.detail} · {p.date}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </div>

        {todo.length > 0 && (
          <div className={profile.column}>
            <ProfileSection>Tests and things to do</ProfileSection>
            <div className={profile.list}>
              {todo.map((p, i) => (
                <Card key={i} level={1} pad="13px 15px" className={s.rx}>
                  <span className={`${s.rxIcon} ${s.rxIconTest}`}><Icon name="flask" size={16} /></span>
                  <div className={s.rxBody}>
                    <div className={s.rxName}>{p.name}</div>
                    <div className={s.rxMeta}>{p.detail} · {p.date}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

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
        <MenuRow icon="key" disabled detail="Managed by your Google account">Change password</MenuRow>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className={s.field}>
      <span className={s.fieldLabel}>{label}</span>
      <input
        className={s.fieldInput}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}
