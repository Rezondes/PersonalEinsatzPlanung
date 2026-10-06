import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WeekSidePanelState {
  /** null until the user has opened or closed the panel once on this device. */
  open: boolean | null;
  setOpen: (open: boolean) => void;
}

/** Below this window width the panel starts collapsed: the table needs the room more. */
const OPEN_BY_DEFAULT_MIN_WIDTH = 1600;

/**
 * Whether the Wochenplanung's "Wochendetails" side panel is open. Persisted locally only, same
 * pattern as navRailStore - a UI-only boolean, never written to Dexie or the backup format.
 */
export const useWeekSidePanelStore = create<WeekSidePanelState>()(
  persist(
    (set) => ({
      open: null,
      setOpen: (open) => set({ open }),
    }),
    { name: 'pep-week-side-panel-open' },
  ),
);

/** The user's last choice wins; before there is one, wide windows start with the panel open. */
export function resolveSidePanelOpen(stored: boolean | null, viewportWidth: number): boolean {
  return stored ?? viewportWidth >= OPEN_BY_DEFAULT_MIN_WIDTH;
}
