// Shared profile-screen chrome (DESIGN §11.7). Both modules build the same
// screen from these: identity header actions, a three-across figure row,
// section titles, and the settings card.
import { Button } from './Button';
import { Card } from './Card';
import { useBreakpoint } from '../../shell/viewport';
import s from './Profile.module.css';

/** Layout classes both modules' profile screens share. */
export const profile = s;

/** Header action. Icon-only on mobile, where the identity block takes the width. */
export function SignOutButton({ onClick }: { onClick: () => void }) {
  const mobile = useBreakpoint() === 'mobile';
  return (
    <Button variant="tertiary" icon="exit" onClick={onClick} aria-label="Sign out">
      {mobile ? undefined : 'Sign out'}
    </Button>
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
