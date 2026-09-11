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

/**
 * Who is signed in. This used to live in the header via AppHeader's `identity`
 * mode, which rendered the name at 22px behind a 52px avatar — so Profile was
 * the one screen in each app whose title was a different size and 64px further
 * in than everywhere else. The header now carries a normal page title and the
 * account moves into the body, where it is content like everything else.
 */
export function IdentityCard({ name, email }: { name: string; email: string }) {
  const initials = name.replace(/^Dr\.\s*/, '').split(/\s+/).filter(Boolean)
    .slice(0, 2).map(w => w[0]).join('').toUpperCase() || '•';
  return (
    <div className={s.identity}>
      <span className={s.identityAvatar}>{initials}</span>
      <div className={s.identityText}>
        <div className={s.identityName}>{name}</div>
        <div className={s.identityEmail}>{email}</div>
      </div>
    </div>
  );
}

export function ProfileSection({ children }: { children: React.ReactNode }) {
  return <div className={s.section}>{children}</div>;
}
