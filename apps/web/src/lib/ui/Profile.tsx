// Shared profile-screen chrome (DESIGN §11.7). Both modules build the same
// screen from these: identity header actions, a three-across figure row,
// section titles, and the settings card.
import { Button } from './Button';
import { Card } from './Card';
import { ink, media, type } from '../theme';
import { useBreakpoint } from '../../shell/viewport';

// Injected once per profile screen.
export const profileCss = `
.vd-stat-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.vd-profile-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
${media.tabletUp}{
  .vd-profile{max-width:860px;margin:0 auto;width:100%;padding:20px 28px 40px!important}
  .vd-stat-row,.vd-profile-pair,.vd-profile-list{max-width:640px}
  .vd-stat-row,.vd-profile-pair{gap:12px}
}
${media.desktopUp}{
  .vd-profile{max-width:1180px;padding:24px 32px 40px!important}
  .vd-stat-row,.vd-profile-pair,.vd-profile-list{max-width:720px}
}`;

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
    <div className="vd-stat-row">
      {items.map(i => (
        <Card key={i.label} level={1} pad={12} style={{ textAlign: 'center' }}>
          <div style={{ ...type.micro, color: ink.secondary }}>{i.label}</div>
          <div style={{ ...type.callout, fontWeight: 700, color: i.tone || ink.primary }}>{i.value}</div>
        </Card>
      ))}
    </div>
  );
}

export function ProfileSection({ children }: { children: React.ReactNode }) {
  return <div style={{ ...type.subhead, fontWeight: 700, color: ink.primary, margin: '18px 4px 10px' }}>{children}</div>;
}
