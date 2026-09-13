// Patient profile: identity in the header, vitals, prescriptions, coverage,
// then settings. The doctor profile mirrors this layout (DESIGN §11.7).
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AppHeader, Button, Card, Disclosure, Icon, MenuRow, MicroLabel, profile, ProfileSection, Sheet, SignOutButton, StatRow, ThemeToggle,
} from '../../../lib/ui';
import { doseForm } from '../../../store/doses';
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
  const [billing, setBilling] = useState(false);
  const nav = useNavigate();
  const open = () => { setDraft(clinic.profile); setEditing(true); };
  const renderTodo = (t: UserRx, i: number) => (
    <Card key={i} level={1} pad="13px 15px" className={s.rx}>
      <span className={`${s.rxIcon} ${s.rxIconTest}`}><Icon name="flask" size={16} /></span>
      <div className={s.rxBody}>
        <div className={s.rxName}>{t.name}</div>
        <div className={s.rxMeta}>{t.detail} · {t.date}</div>
      </div>
    </Card>
  );
  return (
    <div className={profile.screen}>
      <AppHeader
        title={user?.name || 'Alex Kumar'}
        subtitle={<span className={profile.email}>{user?.email || 'alex.kumar@gmail.com'}</span>}
        actions={<><ThemeToggle /><PatientNotify /></>}
        className={s.header}
      />

      {/* Allergy is the field that kills people. It does not share a component
          with AGE, and it does not carry the same 10px label (D28). */}
      <div className={p.allergies ? `${s.allergy} ${s.allergyOn}` : s.allergy}>
        <span className={s.allergyIcon}><Icon name="alert" size={20} /></span>
        <div className={s.allergyBody}>
          <div className={s.allergyLabel}>Allergies</div>
          <div className={s.allergyValue}>{p.allergies || 'None on file'}</div>
        </div>
        <Button variant="tertiary" onClick={open}>{p.allergies ? 'Edit' : 'Add'}</Button>
      </div>

      <StatRow items={[
        { label: 'Age', value: p.age || 'Not set' },
        { label: 'Blood group', value: p.blood || 'Not set' },
      ]} />

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

      {/* Prescriptions are not duplicated here with a second row design: Your
          medicines is the one place doses live, and this links to it (D28). */}
      <ProfileSection>Medicines</ProfileSection>
      <Card level={1} pad={6} className={profile.list}>
        <MenuRow icon="pill" onClick={() => nav('/patient/medicines')}>
          {drugs.length === 0
            ? 'No prescriptions on file'
            : `${drugs.length} prescription${drugs.length === 1 ? '' : 's'} · today's doses`}
        </MenuRow>
      </Card>

      {/* "Tests and follow-ups" is a name a developer gives a bucket. Grouped
          by what the patient has to do about each, oldest work collapsed. */}
      {todo.length > 0 && (
        <>
          <ProfileSection>Tests and follow-ups</ProfileSection>
          {(['due', 'scheduled', 'done'] as const).map(group => {
            const rows = todo.filter(t => followUpGroup(t) === group);
            if (!rows.length) return null;
            const label = group === 'due' ? 'Due now' : group === 'scheduled' ? 'Scheduled' : 'Completed';
            if (group === 'done') {
              return (
                <Disclosure key={group} title={`${label} · ${rows.length}`} defaultOpen={false}>
                  <div className={profile.list}>{rows.map(renderTodo)}</div>
                </Disclosure>
              );
            }
            return (
              <div key={group}>
                <MicroLabel>{label} · {rows.length}</MicroLabel>
                <div className={profile.list}>{rows.map(renderTodo)}</div>
              </div>
            );
          })}
        </>
      )}

      {/* Behind its own row: insurance and card details are not something the
          patient came to this screen to read. */}
      <ProfileSection>Billing</ProfileSection>
      <Card level={1} pad={6} className={profile.list}>
        <MenuRow icon="doc" onClick={() => setBilling(b => !b)} detail="Star Health · •••• 4291">
          Insurance and payment
        </MenuRow>
        {billing && (
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
        )}
      </Card>

      <ProfileSection>Settings</ProfileSection>
      <Card level={1} pad={6} className={profile.list}>
        <MenuRow icon="key" disabled detail="Managed by your Google account">Change password</MenuRow>
      </Card>

      {/* Where the dose ticks actually live. This used to sit in the medicines
          header beside a promise that the doctor is told about missed doses —
          a promise that depends on syncing this record does not (D14). */}
      <ProfileSection>About</ProfileSection>
      <Card level={1} pad="14px 16px" className={profile.list}>
        <div className={s.about}>
          The doses you tick off are kept on this device only. They are not sent
          to your clinic, so tell Dr. Mira in a consultation if you have been
          missing doses.
        </div>
      </Card>

      <SignOutButton onClick={signOut} />
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


// What the patient has to do about a follow-up, from its own date: anything
// dated in the future is scheduled, anything past is either done or overdue.
function followUpGroup(t: UserRx): 'due' | 'scheduled' | 'done' {
  const at = Date.parse(t.date);
  if (Number.isNaN(at)) return 'due';
  if (at > Date.now()) return 'scheduled';
  return at < Date.now() - 30 * 86400000 ? 'done' : 'due';
}
