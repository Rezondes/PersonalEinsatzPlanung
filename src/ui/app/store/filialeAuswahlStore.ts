import { create } from 'zustand';
import type { FilialId } from '@domain/shared/ids';

interface FilialeAuswahlState {
  ausgewaehlteFilialeId: FilialId | null;
  setAusgewaehlteFiliale: (id: FilialId | null) => void;
}

export const useFilialeAuswahlStore = create<FilialeAuswahlState>((set) => ({
  ausgewaehlteFilialeId: null,
  setAusgewaehlteFiliale: (id) => set({ ausgewaehlteFilialeId: id }),
}));
