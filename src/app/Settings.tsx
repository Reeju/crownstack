import { useProgressStore } from '../store/progress';
import type { Settings as SettingsData } from '../store/save';
import { useSessionStore } from '../store/session';
import { useEscape } from './useEscape';

type Toggle = { key: 'haptics' | 'reducedMotion' | 'colorBlind'; label: string; hint: string };

const TOGGLES: Toggle[] = [
  { key: 'haptics', label: 'Vibration', hint: 'Buzz on big hits and purchases' },
  { key: 'reducedMotion', label: 'Reduced motion', hint: 'No screen shake or bobbing' },
  { key: 'colorBlind', label: 'Shape markers', hint: 'Mark raiders and giants with shapes' },
];

const SLIDERS: { key: 'music' | 'sfx'; label: string }[] = [
  { key: 'music', label: 'Music' },
  { key: 'sfx', label: 'Sound effects' },
];

export function Settings() {
  const settings = useProgressStore((s) => s.settings);
  const setSetting = useProgressStore((s) => s.setSetting);
  const back = useSessionStore((s) => s.back);
  useEscape(back);
  const set = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) =>
    setSetting(key, value);

  return (
    <div className="screen scrim" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="panel panel-wide">
        <h2 id="settings-title" className="panel-title">
          Settings
        </h2>

        {SLIDERS.map(({ key, label }) => (
          <label key={key} className="field">
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings[key]}
              onChange={(ev) => set(key, Number(ev.target.value))}
            />
          </label>
        ))}

        {TOGGLES.map(({ key, label, hint }) => (
          <label key={key} className="field">
            <span>
              {label}
              <small>{hint}</small>
            </span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(ev) => set(key, ev.target.checked)}
            />
          </label>
        ))}

        <label className="field">
          <span>
            Graphics
            <small>Auto measures your device at launch</small>
          </span>
          <select
            value={settings.quality}
            onChange={(ev) => set('quality', ev.target.value as SettingsData['quality'])}
          >
            <option value="auto">Auto</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </label>

        <button type="button" className="btn btn-primary" autoFocus onClick={back}>
          Done
        </button>
      </div>
    </div>
  );
}
