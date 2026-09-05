import { useEffect, useRef, useState } from 'react';
import { pressProps } from '@vd/ui';
import { getTheme, gradients, ink, setTheme, surfaces, z, type Theme } from '@vd/theme';
import { go, useAuth } from './auth';

// Shared dismiss: Escape closes; returns a catcher overlay that closes on
// outside tap. Used by account/bell/approve menus.
export function useDismiss(onClose: () => void, enabled = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ref.current();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [enabled]);
}

export function DismissCatcher({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: z.catcher, cursor: 'default' }}
    />
  );
}

function initialsOf(name: string): string {
  const parts = name.replace(/^Dr\.\s*/, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '•';
}

// Module-owned account toolbar: avatar button opening a menu with theme +
// sign-out. Replaces the old global floating pills.
export function AccountMenu({ name, detail, extra }: { name: string; detail: string; extra?: React.ReactNode }) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeState(next);
  };
  useDismiss(() => setOpen(false), open);
  const viewingDoctor = location.pathname.startsWith('/doctor');
  const switchView = () => {
    setOpen(false);
    go(viewingDoctor ? '/patient' : '/doctor');
  };
  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <div
        {...pressProps(() => setOpen(o => !o), `${name} — account menu`)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
        style={{
          width: 38, height: 38, borderRadius: 99, background: gradients.glassBar,
          backdropFilter: 'var(--vd-glass-blur)', WebkitBackdropFilter: 'var(--vd-glass-blur)',
          border: '1px solid var(--vd-glass-border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 13, fontWeight: 700, color: ink.onGlass,
        }}
      >
        {initialsOf(name)}
      </div>
      {open && <DismissCatcher onClose={() => setOpen(false)} />}
      {open && (
        <div role="menu" aria-label="Account" style={{ position: 'absolute', zIndex: z.popover, top: 46, right: 0, width: 248, background: surfaces.card, border: '1px solid var(--vd-border)', borderRadius: 16, padding: 8, boxShadow: '0 20px 50px rgba(12,20,60,.35)' }}>
          <div style={{ padding: '8px 10px 10px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: ink.primary }}>{name}</div>
            <div style={{ fontSize: 12, color: ink.muted }}>{detail}</div>
          </div>
          {extra}
          <div {...pressProps(switchView, viewingDoctor ? 'Switch to patient view' : 'Switch to doctor view')} style={menuRow}>
            <span style={{ flex: 1 }}>{viewingDoctor ? 'Patient view' : 'Doctor view'}</span>
          </div>
          <div {...pressProps(toggleTheme, `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`)} style={menuRow}>
            <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{theme === 'light' ? '☾' : '☀'}</span>
            <span style={{ flex: 1 }}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </div>
          <div {...pressProps(() => { setOpen(false); signOut(); }, 'Sign out')} style={menuRow}>
            <span style={{ flex: 1 }}>Sign out</span>
          </div>
        </div>
      )}
    </div>
  );
}

const menuRow = {
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, minHeight: 44,
  padding: '11px 10px', fontSize: 14, fontWeight: 600, color: ink.body,
} as const;
