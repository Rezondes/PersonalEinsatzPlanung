import { create } from 'zustand';
import type { Filiale } from '@domain/filiale/Filiale';
import { services } from '@infrastructure/services';

interface FilialenState {
  filialen: Filiale[];
  laedt: boolean;
  geladen: boolean;
  neuLaden: () => Promise<void>;
}

/**
 * Shared store instead of per-component local state: multiple components (AppShell, the Stammdaten
 * view, every hook using useAusgewaehlteFiliale) previously each held their own independent copy of
 * the Filialen list, so a save in one place (e.g. deactivating a Filiale) never refreshed the header
 * dropdown elsewhere - a bug found during review. A single shared store fixes that at the root.
 */
export const useFilialenStore = create<FilialenState>((set) => ({
  filialen: [],
  laedt: true,
  geladen: false,
  neuLaden: async () => {
    set({ laedt: true });
    const liste = await services.filiale.alle();
    set({ filialen: liste, laedt: false, geladen: true });
  },
}));
