// Shared viewport hooks (shell-owned): the JS mirror of theme `media.*`.
// Modules must not define their own matchMedia breakpoints. Mobile stops at
// 799.98 so it never overlaps media.tabletUp at exactly 800.
import { useEffect, useState } from 'react';
import { breakpoints, type Breakpoint } from '../lib/theme';

export type { Breakpoint };

const MOBILE_MAX = breakpoints.tablet - 0.02;

function match(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches;
}

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => match(query));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setOn(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return on;
}

export function useIsMobile(bp = MOBILE_MAX): boolean {
  return useMedia(`(max-width: ${bp}px)`);
}

export function useBreakpoint(): Breakpoint {
  const tabletUp = useMedia(`(min-width: ${breakpoints.tablet}px)`);
  const desktopUp = useMedia(`(min-width: ${breakpoints.desktop}px)`);
  return desktopUp ? 'desktop' : tabletUp ? 'tablet' : 'mobile';
}
