import type { RepeatMode } from '../types/feed';
import type { NetworkProfile } from '../hooks/useNetworkProfile';

interface FeedToolbarProps {
  repeatMode: RepeatMode;
  onRepeatModeChange: (mode: RepeatMode) => void;
  network: NetworkProfile;
}

export function FeedToolbar({ repeatMode, onRepeatModeChange, network }: FeedToolbarProps) {
  return (
    <header className="feed-toolbar">
      <div>
        <p className="feed-toolbar__eyebrow">MEDIA FEED</p>
        <p className="feed-toolbar__network" title="Оценка через Network Information API">
          Сеть: {network.tier === 'unknown' ? 'авто' : network.tier}
          {network.saveData ? ' · saveData' : ''}
        </p>
      </div>

      <label className="repeat-control">
        <span>Автопереход</span>
        <select
          value={repeatMode}
          aria-label="Количество повторов до автоперехода"
          onChange={(event) => {
            const value = event.currentTarget.value;
            onRepeatModeChange(value === 'infinite' ? 'infinite' : (Number(value) as 1 | 2 | 3));
          }}
        >
          <option value={1}>после 1</option>
          <option value={2}>после 2</option>
          <option value={3}>после 3</option>
          <option value="infinite">∞</option>
        </select>
      </label>
    </header>
  );
}
