import { useEffect } from 'react';

import { useProgressStore } from '../store/progress';
import { useSessionStore, type Screen } from '../store/session';
import { About } from './About';
import { Countdown } from './Countdown';
import { DebugOverlay } from './DebugOverlay';
import { Fallen } from './Fallen';
import { GameCanvas } from './GameCanvas';
import { Hud } from './Hud';
import { LevelSelect } from './LevelSelect';
import { Pause } from './Pause';
import { Results } from './Results';
import { Settings } from './Settings';
import { Title } from './Title';
import { UpdateToast } from './UpdateToast';
import { Upgrades } from './Upgrades';

/** Screens during which a level is loaded and the HUD stays visible behind any dialog. */
const IN_LEVEL: readonly Screen[] = ['playing', 'paused', 'countdown', 'results', 'fallen'];

export function App() {
  const screen = useSessionStore((s) => s.screen);
  const settingsFrom = useSessionStore((s) => s.settingsFrom);
  const hydrated = useProgressStore((s) => s.hydrated);
  const hydrate = useProgressStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const inLevel = IN_LEVEL.includes(screen) || (screen === 'settings' && settingsFrom === 'paused');

  return (
    <>
      <GameCanvas />
      {inLevel && <Hud />}
      {screen === 'title' && <Title />}
      {screen === 'levels' && hydrated && <LevelSelect />}
      {screen === 'upgrades' && <Upgrades />}
      {screen === 'settings' && <Settings />}
      {screen === 'about' && <About />}
      {screen === 'paused' && <Pause />}
      {screen === 'countdown' && <Countdown />}
      {screen === 'results' && <Results />}
      {screen === 'fallen' && <Fallen />}
      <UpdateToast />
      <DebugOverlay />
    </>
  );
}
