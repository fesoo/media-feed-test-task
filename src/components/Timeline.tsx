interface TimelineProps {
  currentTime: number;
  duration: number;
  bufferedUntil: number;
  onSeek: (time: number) => void;
}

export function Timeline({ currentTime, duration, bufferedUntil, onSeek }: TimelineProps) {
  const safeDuration = Math.max(duration, 0.01);
  const playedPercent = Math.min((currentTime / safeDuration) * 100, 100);
  const bufferedPercent = Math.min((bufferedUntil / safeDuration) * 100, 100);

  return (
    <div className="timeline" aria-label="Прогресс видео">
      <div className="timeline__track" aria-hidden="true">
        <span className="timeline__buffered" style={{ width: `${bufferedPercent}%` }} />
        <span className="timeline__played" style={{ width: `${playedPercent}%` }} />
      </div>
      <input
        className="timeline__input"
        type="range"
        min={0}
        max={safeDuration}
        step={0.05}
        value={Math.min(currentTime, safeDuration)}
        aria-label="Перемотать видео"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onSeek(Number(event.currentTarget.value))}
      />
    </div>
  );
}
