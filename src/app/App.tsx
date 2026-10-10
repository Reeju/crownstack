import { useSessionStore } from '../store/session';
import { Fallen } from './Fallen';
import { GameCanvas } from './GameCanvas';
import { Hud } from './Hud';
import { Pause } from './Pause';
import { Results } from './Results';
import { Title } from './Title';
import { UpdateToast } from './UpdateToast';

export function App() {
  const screen = useSessionStore((s) => s.screen);

  return (
    <>
      <GameCanvas />
      {screen === 'title' && <Title />}
      {screen !== 'title' && <Hud />}
      {screen === 'paused' && <Pause />}
      {screen === 'results' && <Results />}
      {screen === 'fallen' && <Fallen />}
      <UpdateToast />
    </>
  );
}
