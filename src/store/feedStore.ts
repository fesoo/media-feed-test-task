import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RepeatMode } from '../types/feed';

interface FeedState {
  activeIndex: number;
  muted: boolean;
  repeatMode: RepeatMode;
  scrollDirection: 'up' | 'down';
  togglePlaybackToken: number;
  setActiveIndex: (index: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setScrollDirection: (direction: 'up' | 'down') => void;
  requestPlaybackToggle: () => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      activeIndex: 0,
      muted: true,
      repeatMode: 1,
      scrollDirection: 'down',
      togglePlaybackToken: 0,
      setActiveIndex: (activeIndex) => set({ activeIndex }),
      setMuted: (muted) => set({ muted }),
      toggleMuted: () => set((state) => ({ muted: !state.muted })),
      setRepeatMode: (repeatMode) => set({ repeatMode }),
      setScrollDirection: (scrollDirection) => set({ scrollDirection }),
      requestPlaybackToggle: () =>
        set((state) => ({ togglePlaybackToken: state.togglePlaybackToken + 1 })),
    }),
    {
      name: 'media-feed:settings',
      partialize: (state) => ({ repeatMode: state.repeatMode }),
    },
  ),
);
