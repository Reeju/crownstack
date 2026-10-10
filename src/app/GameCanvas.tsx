import { useEffect, useRef } from 'react';

import { Game } from '../game/Game';
import { useSessionStore } from '../store/session';

/** Mounts the WebGL canvas and ties the Game lifetime to the component. */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const store = useSessionStore.getState();
    const game = new Game(canvas, {
      onHud: (hud) => useSessionStore.getState().setHud(hud),
      onPauseRequest: () => {
        const { screen, pause, resume } = useSessionStore.getState();
        if (screen === 'playing') pause();
        else if (screen === 'paused' && !document.hidden) resume();
      },
      onOutcome: (won, result) => useSessionStore.getState().finish(won, result),
    });
    store.attachGame(game);
    // `?debug=1`: lets the capture script and e2e tests jump straight to a level.
    if (new URLSearchParams(location.search).has('debug')) {
      (window as unknown as { __crownstackStart?: (id: number) => void }).__crownstackStart = (
        id,
      ) => useSessionStore.getState().startLevel(id);
    }
    return () => {
      useSessionStore.getState().attachGame(null);
      game.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" data-testid="game-canvas" />;
}
