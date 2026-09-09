import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NavRailState {
  collapsed: boolean;
  toggle: () => void;
}

/**
 * Whether the tablet-landscape NavRail is collapsed to its icon-only 72px width. The first
 * `persist`-backed store in this codebase (every other zustand store here is ephemeral) - a
 * deliberate, low-risk first use: a UI-only boolean, no domain data, written to localStorage under
 * a namespaced key so it survives a reload without needing IndexedDB.
 */
export const useNavRailStore = create<NavRailState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: 'pep-nav-rail-collapsed' },
  ),
);
