import { create } from 'zustand';
import type { EmploymentTypeKind } from '@domain/employee/EmploymentType';
import type { AbsenceType } from '@domain/absence/Absence';
import { useBranchSelectionStore } from './branchSelectionStore';

export interface EmployeeListFilters {
  search: string;
  status: 'all' | 'active' | 'inactive';
  employment: 'all' | EmploymentTypeKind;
  filtersOpen: boolean;
}

export interface AbsenceListFilters {
  /** 'all' or an EmployeeId. */
  employee: string;
  type: 'all' | AbsenceType;
  /** Empty = all years. */
  years: string[];
  filtersOpen: boolean;
}

interface ListFiltersState {
  employees: EmployeeListFilters;
  absences: AbsenceListFilters;
  setEmployeeFilters: (patch: Partial<EmployeeListFilters>) => void;
  setAbsenceFilters: (patch: Partial<AbsenceListFilters>) => void;
  reset: () => void;
}

const DEFAULT_EMPLOYEES: EmployeeListFilters = { search: '', status: 'all', employment: 'all', filtersOpen: false };
const DEFAULT_ABSENCES: AbsenceListFilters = { employee: 'all', type: 'all', years: [], filtersOpen: false };

/**
 * Filter and search of the Mitarbeiter and Abwesenheiten lists, held here instead of in the views'
 * own useState so they survive leaving the page and coming back. Deliberately NOT persisted: a
 * reload starts with "Alle" again, so nobody later mistakes a filtered list for the whole one.
 * Same "small global UI state" rule as the other stores in this folder.
 */
export const useListFiltersStore = create<ListFiltersState>((set) => ({
  employees: DEFAULT_EMPLOYEES,
  absences: DEFAULT_ABSENCES,
  setEmployeeFilters: (patch) => set((s) => ({ employees: { ...s.employees, ...patch } })),
  setAbsenceFilters: (patch) => set((s) => ({ absences: { ...s.absences, ...patch } })),
  reset: () => set({ employees: DEFAULT_EMPLOYEES, absences: DEFAULT_ABSENCES }),
}));

// Another Filiale has other employees: a kept employee filter or search would show an empty list
// with no explanation, so a Filiale change starts both lists fresh.
useBranchSelectionStore.subscribe((state, previous) => {
  if (state.selectedBranchId !== previous.selectedBranchId) useListFiltersStore.getState().reset();
});
