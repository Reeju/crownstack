import { useEffect } from 'react';

/** Calls `onEscape` when Escape is pressed while the calling screen is mounted. */
export function useEscape(onEscape: () => void): void {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEscape]);
}
