import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFeedPage, updateLike } from '../lib/mockApi';
import { readViewedVideoIds } from '../lib/viewedVideos';
import { trackMetric } from '../lib/metrics';
import { useFeedStore } from '../store/feedStore';
import { useNetworkProfile } from '../hooks/useNetworkProfile';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import type { FeedPage, FeedVideo, MediaRole } from '../types/feed';
import { FeedToolbar } from './FeedToolbar';
import { VideoCard } from './VideoCard';

const WINDOW_RADIUS = 4;
const SWIPE_DISTANCE_RATIO = 0.15;
const MIN_SWIPE_VELOCITY = 0.45;
const WHEEL_THRESHOLD = 18;
const TRANSITION_MS = 360;

interface DragState {
  pointerId: number;
  startY: number;
  startTop: number;
  startedAt: number;
}

function getRole(index: number, activeIndex: number): MediaRole {
  if (index === activeIndex) return 'active';
  if (index === activeIndex - 1) return 'previous';
  if (index === activeIndex + 1) return 'next';
  return 'poster';
}

function updateVideoInPages(
  pages: FeedPage[] | undefined,
  videoId: string,
  updater: (video: FeedVideo) => FeedVideo,
): FeedPage[] | undefined {
  return pages?.map((page) => ({
    ...page,
    items: page.items.map((video) => (video.id === videoId ? updater(video) : video)),
  }));
}

export function MediaFeed() {
  const queryClient = useQueryClient();
  const feedRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<number, HTMLElement>());
  const dragRef = useRef<DragState | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const transitioningRef = useRef(false);
  const wheelAccumulatorRef = useRef(0);
  const wheelResetTimeoutRef = useRef<number | null>(null);
  const initialViewedIdsRef = useRef(readViewedVideoIds());

  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const activeIndex = useFeedStore((state) => state.activeIndex);
  const muted = useFeedStore((state) => state.muted);
  const repeatMode = useFeedStore((state) => state.repeatMode);
  const togglePlaybackToken = useFeedStore((state) => state.togglePlaybackToken);
  const setActiveIndex = useFeedStore((state) => state.setActiveIndex);
  const setScrollDirection = useFeedStore((state) => state.setScrollDirection);
  const toggleMuted = useFeedStore((state) => state.toggleMuted);
  const setRepeatMode = useFeedStore((state) => state.setRepeatMode);
  const requestPlaybackToggle = useFeedStore((state) => state.requestPlaybackToggle);

  const network = useNetworkProfile();
  const prefersReducedMotion = usePrefersReducedMotion();

  const feedQuery = useInfiniteQuery({
    queryKey: ['feed', initialViewedIdsRef.current.slice(0, 30)],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) =>
      fetchFeedPage({
        cursor: pageParam,
        excludeIds: initialViewedIdsRef.current,
        signal,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const videos = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data],
  );

  const likeMutation = useMutation({
    mutationFn: ({ videoId, liked }: { videoId: string; liked: boolean }) =>
      updateLike(videoId, liked),
    onMutate: async ({ videoId, liked }) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const snapshot = queryClient.getQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>([
        'feed',
        initialViewedIdsRef.current.slice(0, 30),
      ]);

      queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(
        ['feed', initialViewedIdsRef.current.slice(0, 30)],
        (current) =>
          current
            ? {
                ...current,
                pages:
                  updateVideoInPages(current.pages, videoId, (video) => ({
                    ...video,
                    liked,
                    likes: video.likes + (liked ? 1 : -1),
                  })) ?? current.pages,
              }
            : current,
      );

      trackMetric({ name: liked ? 'like_added' : 'like_removed', videoId });
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(
          ['feed', initialViewedIdsRef.current.slice(0, 30)],
          context.snapshot,
        );
      }
    },
  });

  const finishNavigation = useCallback(() => {
    const targetIndex = pendingIndexRef.current;
    if (targetIndex === null) return;

    pendingIndexRef.current = null;
    transitioningRef.current = false;
    setIsTransitioning(false);
    setActiveIndex(targetIndex);
    trackMetric({ name: 'navigation_completed', videoId: videos[targetIndex]?.id, value: targetIndex });
  }, [setActiveIndex, videos]);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      feedRef.current?.scrollTo({
        top: index * viewportHeight,
        behavior: prefersReducedMotion ? 'auto' : behavior,
      });
    },
    [prefersReducedMotion, viewportHeight],
  );

  const navigateBy = useCallback(
    (delta: -1 | 1, source: 'swipe' | 'wheel' | 'keyboard' | 'auto' = 'swipe') => {
      if (transitioningRef.current || videos.length === 0) return;

      const targetIndex = Math.min(Math.max(activeIndex + delta, 0), videos.length - 1);
      if (targetIndex === activeIndex) {
        scrollToIndex(activeIndex);
        return;
      }

      transitioningRef.current = true;
      setIsTransitioning(true);
      pendingIndexRef.current = targetIndex;
      setScrollDirection(delta > 0 ? 'down' : 'up');
      scrollToIndex(targetIndex);
      trackMetric({
        name: 'navigation_started',
        videoId: videos[targetIndex]?.id,
        value: delta,
        details: { source },
      });

      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }

      transitionTimeoutRef.current = window.setTimeout(
        finishNavigation,
        prefersReducedMotion ? 0 : TRANSITION_MS,
      );
    },
    [activeIndex, finishNavigation, prefersReducedMotion, scrollToIndex, setScrollDirection, videos],
  );

  useEffect(() => {
    if (videos.length === 0) return;
    if (activeIndex < videos.length - 3 || !feedQuery.hasNextPage || feedQuery.isFetchingNextPage) return;
    void feedQuery.fetchNextPage();
  }, [activeIndex, feedQuery, videos.length]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const height = Math.round(entry.contentRect.height);
      setViewportHeight(height);
      feed.scrollTop = activeIndex * height;
    });

    resizeObserver.observe(feed);
    return () => resizeObserver.disconnect();
  }, [activeIndex]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (transitioningRef.current) return;

        const visible = entries
          .filter((entry) => entry.intersectionRatio >= 0.7)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.index);
        if (Number.isInteger(index) && index !== activeIndex) {
          setActiveIndex(index);
        }
      },
      { root: feedRef.current, threshold: [0.5, 0.7, 0.9] },
    );

    itemRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [activeIndex, setActiveIndex, videos.length]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (transitioningRef.current) return;

      wheelAccumulatorRef.current += event.deltaY;

      if (wheelResetTimeoutRef.current !== null) {
        window.clearTimeout(wheelResetTimeoutRef.current);
      }

      wheelResetTimeoutRef.current = window.setTimeout(() => {
        wheelAccumulatorRef.current = 0;
      }, 140);

      if (Math.abs(wheelAccumulatorRef.current) < WHEEL_THRESHOLD) return;

      const direction = wheelAccumulatorRef.current > 0 ? 1 : -1;
      wheelAccumulatorRef.current = 0;
      navigateBy(direction, 'wheel');
    };

    feed.addEventListener('wheel', handleWheel, { passive: false });
    return () => feed.removeEventListener('wheel', handleWheel);
  }, [navigateBy]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || !('onscrollend' in window)) return;

    const handleScrollEnd = () => finishNavigation();
    feed.addEventListener('scrollend', handleScrollEnd);
    return () => feed.removeEventListener('scrollend', handleScrollEnd);
  }, [finishNavigation]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) window.clearTimeout(transitionTimeoutRef.current);
      if (wheelResetTimeoutRef.current !== null) window.clearTimeout(wheelResetTimeoutRef.current);
    };
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || transitioningRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-interactive="true"], input, select, button')) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: feedRef.current?.scrollTop ?? activeIndex * viewportHeight,
      startedAt: performance.now(),
    };

  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const feed = feedRef.current;
    if (!drag || !feed || drag.pointerId !== event.pointerId) return;

    const delta = drag.startY - event.clientY;
    const previousTop = Math.max(0, (activeIndex - 1) * viewportHeight);
    const nextTop = Math.min((videos.length - 1) * viewportHeight, (activeIndex + 1) * viewportHeight);
    feed.scrollTop = Math.min(Math.max(drag.startTop + delta * 0.72, previousTop), nextTop);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const delta = drag.startY - event.clientY;
    const elapsed = Math.max(performance.now() - drag.startedAt, 1);
    const velocity = Math.abs(delta) / elapsed;
    const passedThreshold = Math.abs(delta) >= viewportHeight * SWIPE_DISTANCE_RATIO;
    const passedVelocity = velocity >= MIN_SWIPE_VELOCITY;

    dragRef.current = null;

    if (passedThreshold || passedVelocity) {
      navigateBy(delta > 0 ? 1 : -1, 'swipe');
    } else {
      scrollToIndex(activeIndex);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateBy(1, 'keyboard');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateBy(-1, 'keyboard');
    } else if (event.key === ' ') {
      event.preventDefault();
      requestPlaybackToggle();
    } else if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      toggleMuted();
    }
  };

  if (feedQuery.isPending) {
    return (
      <main className="feed-status" role="status">
        <div className="buffering-indicator" />
        <p>Загружаем ленту…</p>
      </main>
    );
  }

  if ((feedQuery.isError && videos.length === 0) || videos.length === 0) {
    return (
      <main className="feed-status" role="alert">
        <p>Не удалось получить ленту.</p>
        <button type="button" onClick={() => void feedQuery.refetch()}>
          Повторить
        </button>
      </main>
    );
  }

  const windowStart = Math.max(0, activeIndex - WINDOW_RADIUS);
  const windowEnd = Math.min(videos.length, activeIndex + WINDOW_RADIUS + 1);
  const visibleVideos = videos.slice(windowStart, windowEnd);

  return (
    <main className="app-shell">
      <FeedToolbar repeatMode={repeatMode} onRepeatModeChange={setRepeatMode} network={network} />

      <div
        ref={feedRef}
        className={isTransitioning ? 'media-feed media-feed--transitioning' : 'media-feed'}
        tabIndex={0}
        aria-label="Вертикальная лента видео. Стрелки вверх и вниз переключают ролики."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
      >
        {windowStart > 0 && (
          <div className="feed-spacer" style={{ height: windowStart * viewportHeight }} aria-hidden="true" />
        )}

        {visibleVideos.map((video, localIndex) => {
          const index = windowStart + localIndex;
          const role = getRole(index, activeIndex);

          return (
            <section
              key={video.id}
              ref={(element) => {
                if (element) itemRefs.current.set(index, element);
                else itemRefs.current.delete(index);
              }}
              className="feed-item"
              data-index={index}
              aria-current={index === activeIndex ? 'true' : undefined}
            >
              <VideoCard
                video={video}
                role={role}
                isActive={index === activeIndex}
                muted={muted}
                repeatMode={repeatMode}
                network={network}
                togglePlaybackToken={togglePlaybackToken}
                onToggleMuted={toggleMuted}
                onToggleLike={(selectedVideo) =>
                  likeMutation.mutate({ videoId: selectedVideo.id, liked: !selectedVideo.liked })
                }
                onNavigateNext={() => navigateBy(1, 'auto')}
              />
            </section>
          );
        })}

        {windowEnd < videos.length && (
          <div
            className="feed-spacer"
            style={{ height: (videos.length - windowEnd) * viewportHeight }}
            aria-hidden="true"
          />
        )}

        {feedQuery.isFetchingNextPage && (
          <div className="next-page-indicator" role="status">
            Загружаем следующую страницу…
          </div>
        )}

        {feedQuery.isFetchNextPageError && (
          <button
            type="button"
            className="next-page-indicator next-page-indicator--error"
            onClick={() => void feedQuery.fetchNextPage()}
          >
            Не удалось дозагрузить. Повторить
          </button>
        )}
      </div>

      <div className="feed-counter" aria-live="polite">
        {activeIndex + 1} / {videos.length}
      </div>
    </main>
  );
}
