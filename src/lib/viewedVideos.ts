const STORAGE_KEY = 'media-feed:viewed-video-ids';
const MAX_VIEWED_IDS = 500;

interface ViewedVideo {
  id: string;
  viewedAt: number;
}

function isViewedVideo(value: unknown): value is ViewedVideo {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.viewedAt === 'number';
}

export function readViewedVideoIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isViewedVideo).map((item) => item.id);
  } catch {
    return [];
  }
}

export function markVideoViewed(id: string): void {
  try {
    const current = readViewedVideoIds().filter((storedId) => storedId !== id);
    const withDates: ViewedVideo[] = [
      { id, viewedAt: Date.now() },
      ...current.map((storedId, index) => ({
        id: storedId,
        viewedAt: Date.now() - index - 1,
      })),
    ].slice(0, MAX_VIEWED_IDS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(withDates));
  } catch {
    // Persistence is optional. The feed must work when storage is unavailable.
  }
}
