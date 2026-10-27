// Shared viewport hooks (shell-owned): the JS mirror of theme `media.*`.
// Modules must not define their own matchMedia breakpoints.
import { useEffect, useState } from 'react';
import { breakpoints, type Breakpoint } from '../lib/theme';

export type { Breakpoint };

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

export function useBreakpoint(): Breakpoint {
  const tabletUp = useMedia(`(min-width: ${breakpoints.tablet}px)`);
  const desktopUp = useMedia(`(min-width: ${breakpoints.desktop}px)`);
  return desktopUp ? 'desktop' : tabletUp ? 'tablet' : 'mobile';
}
