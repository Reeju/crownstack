import { useSessionStore } from '../store/session';
import { GameCanvas } from './GameCanvas';
import { Hud } from './Hud';
import { Pause } from './Pause';
import { Title } from './Title';
import { UpdateToast } from './UpdateToast';

export function App() {
  const screen = useSessionStore((s) => s.screen);

  return (
    <>
      <GameCanvas />
      {screen === 'title' && <Title />}
      {(screen === 'playing' || screen === 'paused') && <Hud />}
      {screen === 'paused' && <Pause />}
      <UpdateToast />
    </>
  );
}
