import type { FeedMetric } from '../types/feed';

declare global {
  interface Window {
    __FEED_METRICS__?: FeedMetric[];
  }
}

const MAX_METRICS = 300;

export function trackMetric(metric: Omit<FeedMetric, 'timestamp'>): void {
  const entry: FeedMetric = {
    ...metric,
    timestamp: performance.now(),
  };

  window.__FEED_METRICS__ ??= [];
  window.__FEED_METRICS__.push(entry);

  if (window.__FEED_METRICS__.length > MAX_METRICS) {
    window.__FEED_METRICS__.splice(0, window.__FEED_METRICS__.length - MAX_METRICS);
  }

  if (import.meta.env.DEV) {
    console.debug('[feed metric]', entry);
  }
}
