import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 350;

/** Counts a displayed number toward `target` over a short time, for the HUD gold. */
export function useTween(target: number, animate: boolean): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    if (!animate) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number): void => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      const value = Math.round(origin + (target - origin) * t);
      from.current = value;
      setShown(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);

  return shown;
}
