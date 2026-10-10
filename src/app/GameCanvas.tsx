import { useEffect, useRef } from 'react';

import { useProgressStore } from '../store/progress';
import { useSessionStore } from '../store/session';

/**
 * Mounts the WebGL canvas and ties the Game lifetime to the component. The
 * engine (three.js, simulation, renderer, audio) is a separate chunk loaded
 * after the title screen has painted.
 */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = (): void => {};

    void import('../game/Game').then(({ Game }) => {
      if (disposed) return;
      const game = new Game(canvas, {
        onHud: (hud) => useSessionStore.getState().setHud(hud),
        onPauseRequest: () => {
          const { screen, pause, resume } = useSessionStore.getState();
          if (screen === 'playing') pause();
          else if (screen === 'paused' && !document.hidden) resume();
        },
        onOutcome: (won, result) => useSessionStore.getState().finish(won, result),
      });
      useSessionStore.getState().attachGame(game);
      // Settings reach the game as soon as they change (and once the save has loaded).
      game.applySettings(useProgressStore.getState().settings);
      const unsubscribe = useProgressStore.subscribe((state, prev) => {
        if (state.settings !== prev.settings) game.applySettings(state.settings);
      });
      // `?debug=1`: lets the capture script and e2e tests jump straight to a level.
      if (new URLSearchParams(location.search).has('debug')) {
        (window as unknown as { __crownstackStart?: (id: number) => void }).__crownstackStart = (
          id,
        ) => useSessionStore.getState().startLevel(id);
      }
      cleanup = () => {
        unsubscribe();
        useSessionStore.getState().attachGame(null);
        game.dispose();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" data-testid="game-canvas" />;
}
