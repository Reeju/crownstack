import { useEffect, useState } from 'react';

import { useSessionStore } from '../store/session';

const STEP_MS = 650;

/** 3-2-1 before play resumes, so the player is not dropped straight back into a fight (SPEC §7.3). */
export function Countdown() {
  const finishCountdown = useSessionStore((s) => s.finishCountdown);
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count === 0) {
      finishCountdown();
      return;
    }
    const timer = window.setTimeout(() => setCount(count - 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [count, finishCountdown]);

  return (
    <div className="screen countdown" role="status" aria-live="assertive">
      <span key={count} className="countdown-number">
        {count || ''}
      </span>
    </div>
  );
}
