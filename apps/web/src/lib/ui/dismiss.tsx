// Shared dismiss: Escape hook + outside-tap catcher overlay.
import { useEffect, useRef } from 'react';
import { z } from '../theme';

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
