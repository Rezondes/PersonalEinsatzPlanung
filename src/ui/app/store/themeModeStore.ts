import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeModeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

/**
 * The user's chosen appearance (Hell/Dunkel/System), persisted locally only - same pattern as
 * navRailStore/localeStore, never written to Dexie or the JSON/Google-Drive backup format.
 * Defaults to 'light': an existing user's appearance must not silently change just because their
 * OS happens to be set to dark - 'system' stays available as a deliberate opt-in, never a default.
 */
export const useThemeModeStore = create<ThemeModeState>()(
  persist(
    (set) => ({
      mode: 'light',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'pep-theme-mode' },
  ),
);
