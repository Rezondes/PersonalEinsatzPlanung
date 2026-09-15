import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AccentColorKey } from '../theme/accentColors';

interface AccentColorState {
  accentColor: AccentColorKey;
  setAccentColor: (accentColor: AccentColorKey) => void;
}

export const useAccentColorStore = create<AccentColorState>()(
  persist(
    (set) => ({
      accentColor: 'gruen',
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    { name: 'pep-accent-color' },
  ),
);
