// Account toolbar: 44 avatar button opening a Popover with view-switch,
// theme toggle, and sign-out. Shared by patient + doctor headers and rails.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getTheme, ink, radius, setTheme, type, type Theme } from '../theme';
import { useAuth } from '../../shell/auth';
import { MenuRow, Popover } from './Sheet';

function initialsOf(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '•';
}

export function AccountMenu({ name, detail, extra }: { name: string; detail: string; extra?: React.ReactNode }) {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeState(next);
  };
  const viewingDoctor = location.pathname.startsWith('/doctor');
  const switchView = () => {
    setOpen(false);
    nav(viewingDoctor ? '/patient' : '/doctor');
  };
  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name} — account menu`}
        title={name}
        className="vd-glass"
        style={{
          width: 44, height: 44, borderRadius: radius.pill, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: ink.onGlass,
          ...type.subhead, fontWeight: 700, boxShadow: 'var(--vd-glass-hi), var(--vd-elev-1)',
        }}
      >
        {initialsOf(name)}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} label="Account" top={52} width={248}>
        <div style={{ padding: '8px 10px 10px' }}>
          <div style={{ ...type.callout, fontWeight: 700, color: ink.primary }}>{name}</div>
          <div style={{ ...type.footnote, color: ink.secondary }}>{detail}</div>
        </div>
        {extra}
        <MenuRow icon="person" onClick={switchView}>{viewingDoctor ? 'Patient view' : 'Doctor view'}</MenuRow>
        <MenuRow icon={theme === 'light' ? 'moon' : 'sun'} onClick={toggleTheme}>
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </MenuRow>
        <MenuRow icon="x" onClick={() => { setOpen(false); signOut(); }}>Sign out</MenuRow>
      </Popover>
    </div>
  );
}
