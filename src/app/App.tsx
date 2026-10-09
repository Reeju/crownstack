import { useSessionStore } from '../store/session';
import { GameCanvas } from './GameCanvas';
import { Title } from './Title';
import { UpdateToast } from './UpdateToast';

export function App() {
  const screen = useSessionStore((s) => s.screen);

  return (
    <>
      <GameCanvas />
      {screen === 'title' && <Title />}
      <UpdateToast />
    </>
  );
}
