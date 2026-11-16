import { useEffect, useRef, type RefObject } from 'react';
import Hls from 'hls.js';
import type { MediaRole } from '../types/feed';

interface MediaSourceParams {
  videoRef: RefObject<HTMLVideoElement | null>;
  hlsUrl?: string;
  mp4Url: string;
  role: MediaRole;
  shouldAttach: boolean;
  onFatalError: () => void;
}

function getBufferLength(role: MediaRole): number {
  if (role === 'active') return 12;
  if (role === 'next') return 6;
  return 1;
}

export function useMediaSource({
  videoRef,
  hlsUrl,
  mp4Url,
  role,
  shouldAttach,
  onFatalError,
}: MediaSourceParams): void {
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const hls = hlsRef.current;
    if (hls) {
      hls.config.maxBufferLength = getBufferLength(role);
    }
  }, [role]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!shouldAttach) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      return;
    }

    if (!hlsUrl) {
      const absoluteMp4Url = new URL(mp4Url, window.location.href).href;
      if (video.src !== absoluteMp4Url) {
        video.src = mp4Url;
      }

      return () => {
        video.pause();
      };
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      const absoluteHlsUrl = new URL(hlsUrl, window.location.href).href;
      if (video.src !== absoluteHlsUrl) {
        video.src = hlsUrl;
      }

      return () => {
        video.pause();
      };
    }

    if (!Hls.isSupported()) {
      const absoluteMp4Url = new URL(mp4Url, window.location.href).href;
      if (video.src !== absoluteMp4Url) {
        video.src = mp4Url;
      }

      return () => {
        video.pause();
      };
    }

    const hls = new Hls({
      enableWorker: true,
      capLevelToPlayerSize: true,
      startLevel: -1,
      maxBufferLength: getBufferLength(role),
      backBufferLength: 0,
      maxBufferHole: 0.5,
    });

    hlsRef.current = hls;
    hls.attachMedia(video);
    hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(hlsUrl));
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
        return;
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
        return;
      }

      onFatalError();
    });

    return () => {
      hls.stopLoad();
      hls.detachMedia();
      hls.destroy();
      hlsRef.current = null;
    };
  }, [hlsUrl, mp4Url, onFatalError, shouldAttach, videoRef]);
}
