import { create } from 'zustand';
import type { Kalenderwoche } from '@domain/shared/Kalenderwoche';
import { kalenderwocheVonDatum } from '@domain/shared/Kalenderwoche';

interface KalenderwocheState {
  ausgewaehlteWoche: Kalenderwoche;
  setAusgewaehlteWoche: (kw: Kalenderwoche) => void;
}

export const useKalenderwocheStore = create<KalenderwocheState>((set) => ({
  ausgewaehlteWoche: kalenderwocheVonDatum(new Date()),
  setAusgewaehlteWoche: (kw) => set({ ausgewaehlteWoche: kw }),
}));
