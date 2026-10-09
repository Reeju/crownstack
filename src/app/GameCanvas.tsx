import { useEffect, useRef } from 'react';

import { Game } from '../game/Game';

/** Mounts the WebGL canvas and ties the Game lifetime to the component. */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    return () => game.dispose();
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" data-testid="game-canvas" />;
}
