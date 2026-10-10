import { useEffect, useState } from 'react';

import { useSessionStore } from '../store/session';

const ENABLED = new URLSearchParams(location.search).has('debug');

/** `?debug=1`: frame rate, simulation and render cost, draw calls and quality tier (SPEC §7.3). */
export function DebugOverlay() {
  const game = useSessionStore((s) => s.game);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!ENABLED || !game) return;
    const timer = window.setInterval(() => {
      const { fps, simMs, renderMs, drawCalls } = game.perf;
      setText(
        `${fps.toFixed(0)} fps · sim ${simMs.toFixed(2)} ms · render ${renderMs.toFixed(2)} ms · ${drawCalls} calls · ${game.quality}`,
      );
    }, 500);
    return () => window.clearInterval(timer);
  }, [game]);

  return ENABLED ? <pre className="debug-overlay">{text}</pre> : null;
}
