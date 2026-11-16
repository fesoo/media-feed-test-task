import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { FeedVideo, MediaRole, RepeatMode } from '../types/feed';
import type { NetworkProfile } from '../hooks/useNetworkProfile';
import { useMediaSource } from '../hooks/useMediaSource';
import { markVideoViewed } from '../lib/viewedVideos';
import { trackMetric } from '../lib/metrics';
import { HeartIcon, PauseIcon, PlayIcon, RefreshIcon, VolumeIcon } from './Icons';
import { Timeline } from './Timeline';

interface VideoCardProps {
  video: FeedVideo;
  role: MediaRole;
  isActive: boolean;
  muted: boolean;
  repeatMode: RepeatMode;
  network: NetworkProfile;
  togglePlaybackToken: number;
  onToggleMuted: () => void;
  onToggleLike: (video: FeedVideo) => void;
  onNavigateNext: () => void;
}

interface PointerGesture {
  startX: number;
  startY: number;
  longPressed: boolean;
  timerId: number;
}

function formatLikes(likes: number): string {
  if (likes >= 1000) return `${(likes / 1000).toFixed(likes >= 10_000 ? 0 : 1)}K`;
  return String(likes);
}

function getPreload(role: MediaRole, network: NetworkProfile): 'none' | 'metadata' | 'auto' {
  if (role === 'active') return 'auto';
  if (role === 'previous') return 'metadata';
  if (role === 'next') {
    return network.tier === 'fast' || network.tier === 'unknown' ? 'auto' : 'metadata';
  }
  return 'none';
}

export const VideoCard = memo(function VideoCard({
  video,
  role,
  isActive,
  muted,
  repeatMode,
  network,
  togglePlaybackToken,
  onToggleMuted,
  onToggleLike,
  onNavigateNext,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pointerGestureRef = useRef<PointerGesture | null>(null);
  const rafRef = useRef<number | null>(null);
  const loopsRef = useRef(0);
  const viewedRef = useRef(false);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const playbackStartedAtRef = useRef<number | null>(null);
  const firstFrameTrackedRef = useRef(false);
  const lastToggleTokenRef = useRef(togglePlaybackToken);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [duration, setDuration] = useState(video.durationSeconds);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedUntil, setBufferedUntil] = useState(0);
  const [fatalError, setFatalError] = useState(false);

  const shouldAttach = role !== 'poster';
  const preload = getPreload(role, network);

  const handleFatalSourceError = useCallback(() => {
    setFatalError(true);
    trackMetric({ name: 'media_fatal_error', videoId: video.id });
  }, [video.id]);

  useMediaSource({
    videoRef,
    hlsUrl: video.hlsUrl,
    mp4Url: video.mp4Url,
    role,
    shouldAttach,
    onFatalError: handleFatalSourceError,
  });

  const updateProgress = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;

    const now = performance.now();
    const lastUpdate = Number(element.dataset.lastUiUpdate ?? 0);

    if (now - lastUpdate >= 100) {
      element.dataset.lastUiUpdate = String(now);
      setCurrentTime(element.currentTime);
      setDuration(Number.isFinite(element.duration) ? element.duration : video.durationSeconds);

      if (element.buffered.length > 0) {
        setBufferedUntil(element.buffered.end(element.buffered.length - 1));
      }

      const watchedEnough =
        element.currentTime >= 2 ||
        (Number.isFinite(element.duration) && element.duration > 0 && element.currentTime / element.duration >= 0.25);

      if (watchedEnough && !viewedRef.current) {
        viewedRef.current = true;
        markVideoViewed(video.id);
        trackMetric({ name: 'video_marked_viewed', videoId: video.id, value: element.currentTime });
      }
    }

    rafRef.current = window.requestAnimationFrame(updateProgress);
  }, [video.durationSeconds, video.id]);

  const play = useCallback(async () => {
    const element = videoRef.current;
    if (!element || fatalError) return;

    try {
      playbackStartedAtRef.current = performance.now();
      await element.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [fatalError]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlayback = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) void play();
    else pause();
  }, [pause, play]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    element.muted = muted;
  }, [muted]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    loopsRef.current = 0;
    viewedRef.current = false;
    firstFrameTrackedRef.current = false;
    retryCountRef.current = 0;
    setFatalError(false);
    setCurrentTime(0);
    setBufferedUntil(0);

    if (isActive) {
      element.currentTime = 0;
      element.playbackRate = 1;
      void play();
      rafRef.current = window.requestAnimationFrame(updateProgress);
      trackMetric({ name: 'video_activated', videoId: video.id });
    } else {
      element.pause();
      element.currentTime = 0;
      setIsPlaying(false);
    }

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      if (retryTimeoutRef.current !== null) window.clearTimeout(retryTimeoutRef.current);
    };
  }, [isActive, play, updateProgress, video.id]);

  useEffect(() => {
    if (togglePlaybackToken === lastToggleTokenRef.current) return;
    lastToggleTokenRef.current = togglePlaybackToken;
    if (isActive) togglePlayback();
  }, [isActive, togglePlayback, togglePlaybackToken]);

  const resetPlaybackRate = useCallback(() => {
    const element = videoRef.current;
    if (element) element.playbackRate = 1;
    setIsFastForwarding(false);
  }, []);

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const timerId = window.setTimeout(() => {
      const element = videoRef.current;
      if (!element || !isActive) return;

      element.playbackRate = 2;
      setIsFastForwarding(true);

      if (pointerGestureRef.current) {
        pointerGestureRef.current.longPressed = true;
      }
    }, 420);

    event.currentTarget.setPointerCapture(event.pointerId);

    pointerGestureRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      longPressed: false,
      timerId,
    };
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current;
    if (!gesture) return;

    const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
    if (distance > 10 && !gesture.longPressed) {
      window.clearTimeout(gesture.timerId);
    }
  };

  const handleStagePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = pointerGestureRef.current;
    if (!gesture) return;

    window.clearTimeout(gesture.timerId);
    const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);

    if (gesture.longPressed) {
      resetPlaybackRate();
    } else if (distance < 10 && isActive) {
      togglePlayback();
    }

    pointerGestureRef.current = null;
  };

  const handleEnded = () => {
    const element = videoRef.current;
    if (!element) return;

    loopsRef.current += 1;
    trackMetric({ name: 'video_completed', videoId: video.id, value: loopsRef.current });

    if (repeatMode === 'infinite' || loopsRef.current < repeatMode) {
      element.currentTime = 0;
      void play();
      return;
    }

    loopsRef.current = 0;
    onNavigateNext();
  };

  const handleMediaError = () => {
    const element = videoRef.current;
    if (!element || fatalError) return;

    if (retryCountRef.current >= 2) {
      handleFatalSourceError();
      return;
    }

    const attempt = retryCountRef.current + 1;
    retryCountRef.current = attempt;
    const delay = 400 * 2 ** (attempt - 1);

    retryTimeoutRef.current = window.setTimeout(() => {
      element.load();
      if (isActive) void play();
    }, delay);
  };

  const handleRetry = () => {
    const element = videoRef.current;
    if (!element) return;

    retryCountRef.current = 0;
    setFatalError(false);
    element.load();
    if (isActive) void play();
  };

  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);

    if (!firstFrameTrackedRef.current && playbackStartedAtRef.current !== null) {
      firstFrameTrackedRef.current = true;
      trackMetric({
        name: 'time_to_first_frame',
        videoId: video.id,
        value: performance.now() - playbackStartedAtRef.current,
      });
    }
  };

  const handleSeek = (time: number) => {
    const element = videoRef.current;
    if (!element) return;
    element.currentTime = time;
    setCurrentTime(time);
    trackMetric({ name: 'timeline_seek', videoId: video.id, value: time });
  };

  return (
    <article className="video-card" aria-label={`${video.author}: ${video.title}`}>
      <img className="video-card__poster" src={video.posterUrl} alt="" aria-hidden="true" />

      {shouldAttach && (
        <video
          ref={videoRef}
          className="video-card__media"
          poster={video.posterUrl}
          preload={preload}
          playsInline
          muted={muted}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onPlaying={handlePlaying}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => {
            setIsBuffering(true);
            trackMetric({ name: 'buffering_started', videoId: video.id });
          }}
          onCanPlay={() => setIsBuffering(false)}
          onEnded={handleEnded}
          onError={handleMediaError}
        />
      )}

      <div
        className="video-card__gesture-layer"
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerEnd}
        onPointerCancel={handleStagePointerEnd}
        aria-label="Нажмите для паузы или удерживайте для скорости 2x"
      />

      <div className="video-card__shade" aria-hidden="true" />

      {isActive && !isPlaying && !isBuffering && !fatalError && (
        <div className="playback-indicator" aria-hidden="true">
          <PlayIcon />
        </div>
      )}

      {isActive && isBuffering && !fatalError && (
        <div className="buffering-indicator" role="status" aria-label="Видео загружается" />
      )}

      {isFastForwarding && <div className="speed-badge">2×</div>}

      {fatalError && (
        <div className="media-error" role="alert">
          <p>Не удалось загрузить видео</p>
          <button type="button" onClick={handleRetry} onPointerDown={(event) => event.stopPropagation()}>
            <RefreshIcon />
            Повторить
          </button>
        </div>
      )}

      <div className="video-card__content">
        <div className="video-card__copy">
          <p className="video-card__author">{video.author}</p>
          <h2>{video.title}</h2>
          <p>{video.description}</p>
        </div>

        <div className="video-actions" data-interactive="true">
          <button
            type="button"
            className={video.liked ? 'video-action video-action--liked' : 'video-action'}
            aria-label={video.liked ? 'Убрать лайк' : 'Поставить лайк'}
            aria-pressed={video.liked}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleLike(video);
            }}
          >
            <HeartIcon filled={video.liked} />
            <span>{formatLikes(video.likes)}</span>
          </button>

          <button
            type="button"
            className="video-action"
            aria-label={muted ? 'Включить звук' : 'Выключить звук'}
            aria-pressed={!muted}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleMuted();
            }}
          >
            <VolumeIcon muted={muted} />
            <span>{muted ? 'Звук' : 'Вкл.'}</span>
          </button>

          <button
            type="button"
            className="video-action"
            aria-label={isPlaying ? 'Поставить на паузу' : 'Продолжить воспроизведение'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              togglePlayback();
            }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
            <span>{isPlaying ? 'Пауза' : 'Старт'}</span>
          </button>
        </div>
      </div>

      {isActive && (
        <Timeline
          currentTime={currentTime}
          duration={duration}
          bufferedUntil={bufferedUntil}
          onSeek={handleSeek}
        />
      )}
    </article>
  );
});
