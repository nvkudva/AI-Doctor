// Shared viewport hook (shell-owned): JS mirror of media.tabletUp.
// Modules must not define their own matchMedia breakpoints.
import { useEffect, useState } from 'react';
import { breakpoints } from '../lib/theme';

export function useIsMobile(bp = breakpoints.tablet): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= bp,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [bp]);
  return mobile;
}
