// Shared profile-screen chrome (DESIGN §11.7). Both modules build the same
// screen from these: identity header actions, a three-across figure row,
// section titles, and the settings card.
import { Button } from './Button';
import { Card } from './Card';
import s from './Profile.module.css';

/** Layout classes both modules' profile screens share. */
export const profile = s;

/** Header action. Icon-only on mobile, where the identity block takes the width. */
// Signing out is the one destructive control on the page, so it does not sit in
// the header's utility cluster wearing the same circle as theme and
// notifications — it is a named row at the foot of the profile, where nothing
// is next to it to mis-tap (D32).
export function SignOutButton({ onClick }: { onClick: () => void }) {
  return (
    <div className={s.signOutRow}>
      <Button variant="tertiary" icon="exit" fullWidth onClick={onClick}>
        Sign out
      </Button>
    </div>
  );
}

export function StatRow({ items }: { items: { label: string; value: string; tone?: string }[] }) {
  return (
    <div className={s.statRow}>
      {items.map(i => (
        <Card key={i.label} level={1} pad={12} className={s.stat}>
          <div className={s.statLabel}>{i.label}</div>
          <div className={s.statValue} style={i.tone ? { color: i.tone } : undefined}>{i.value}</div>
        </Card>
      ))}
    </div>
  );
}

export function ProfileSection({ children }: { children: React.ReactNode }) {
  return <div className={s.section}>{children}</div>;
}
