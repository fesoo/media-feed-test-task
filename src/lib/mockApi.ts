import type { FeedPage, FeedVideo } from '../types/feed';

const PAGE_SIZE = 15;
const CATALOG_SIZE = 45;

const AUTHORS = ['@motion_lab', '@framecraft', '@frontend_daily', '@pixel_route', '@web_stream'];
const TITLES = [
  'Fast start, smooth playback',
  'One gesture — one video',
  'Adaptive media preload',
  'Native video controls',
  'Virtualized heavy content',
  'Optimistic interactions',
];

const catalog: FeedVideo[] = Array.from({ length: CATALOG_SIZE }, (_, index) => {
  const assetIndex = (index % 6) + 1;

  return {
    id: `video-${String(index + 1).padStart(2, '0')}`,
    author: AUTHORS[index % AUTHORS.length],
    title: TITLES[index % TITLES.length],
    description: `Демонстрационный ролик ${index + 1}. Локальный MP4 используется только для автономного запуска прототипа.`,
    posterUrl: `/media/poster-${assetIndex}.webp`,
    mp4Url: `/media/video-${assetIndex}.mp4`,
    liked: index % 8 === 0,
    likes: 1200 + index * 37,
    durationSeconds: 6,
  };
});

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeoutId);
        reject(new DOMException('The request was aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export async function fetchFeedPage(params: {
  cursor: number | null;
  excludeIds: string[];
  signal?: AbortSignal;
}): Promise<FeedPage> {
  const { cursor, excludeIds, signal } = params;
  await delay(380, signal);

  const excluded = new Set(excludeIds);
  const personalizedCatalog = [
    ...catalog.filter((video) => !excluded.has(video.id)),
    ...catalog.filter((video) => excluded.has(video.id)),
  ];

  const start = cursor ?? 0;
  const items = personalizedCatalog.slice(start, start + PAGE_SIZE);
  const nextCursor = start + PAGE_SIZE < personalizedCatalog.length ? start + PAGE_SIZE : null;

  return { items, nextCursor };
}

export async function updateLike(videoId: string, liked: boolean): Promise<void> {
  await delay(220);

  const video = catalog.find((item) => item.id === videoId);
  if (video) {
    video.liked = liked;
    video.likes += liked ? 1 : -1;
  }
}
