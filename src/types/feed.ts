export type RepeatMode = 1 | 2 | 3 | 'infinite';

export type MediaRole = 'previous' | 'active' | 'next' | 'poster';

export interface FeedVideo {
  id: string;
  author: string;
  title: string;
  description: string;
  posterUrl: string;
  mp4Url: string;
  hlsUrl?: string;
  liked: boolean;
  likes: number;
  durationSeconds: number;
}

export interface FeedPage {
  items: FeedVideo[];
  nextCursor: number | null;
}

export interface FeedMetric {
  name: string;
  videoId?: string;
  value?: number;
  details?: Record<string, unknown>;
  timestamp: number;
}
