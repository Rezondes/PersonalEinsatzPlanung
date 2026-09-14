import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from './locale';
import { DEFAULT_LOCALE } from './locale';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * Mirror of the URL's current locale segment, in localStorage only - never Dexie, never the
 * export/backup format. Same persisted-Zustand-store pattern as `app/store/navRailStore.ts` (a
 * UI-only value, no domain data). The loader-validated `:locale` route param stays the render-time
 * source of truth (see `useLocale.ts`); this store exists for anything that can't reach
 * `useParams()` directly, and is kept in sync by `LocaleRoot.tsx`.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'pep-locale' },
  ),
);
