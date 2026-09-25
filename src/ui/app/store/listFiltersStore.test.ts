import { describe, it, expect, beforeEach } from 'vitest';
import type { BranchId } from '@domain/shared/ids';
import { useBranchSelectionStore } from './branchSelectionStore';
import { useListFiltersStore } from './listFiltersStore';

const state = () => useListFiltersStore.getState();

describe('listFiltersStore', () => {
  beforeEach(() => {
    useBranchSelectionStore.setState({ selectedBranchId: 'b1' as BranchId });
    state().reset();
  });

  it('starts every filter at "Alle", with the filter panel closed and no search', () => {
    expect(state().employees).toEqual({ search: '', status: 'all', employment: 'all', filtersOpen: false });
    expect(state().absences).toEqual({ employee: 'all', type: 'all', years: [], filtersOpen: false });
  });

  it('keeps what a view set, so it survives the view unmounting', () => {
    state().setEmployeeFilters({ search: 'Mül', status: 'active' });
    state().setAbsenceFilters({ type: 'Vacation', years: ['2026'] });

    expect(state().employees).toMatchObject({ search: 'Mül', status: 'active', employment: 'all' });
    expect(state().absences).toMatchObject({ type: 'Vacation', years: ['2026'], employee: 'all' });
  });

  it('reset() puts both lists back to their defaults', () => {
    state().setEmployeeFilters({ search: 'Mül' });
    state().setAbsenceFilters({ type: 'Illness' });

    state().reset();

    expect(state().employees.search).toBe('');
    expect(state().absences.type).toBe('all');
  });

  it('resets both lists when the selected Filiale changes (an old employee filter would empty the list)', () => {
    state().setEmployeeFilters({ search: 'Mül' });
    state().setAbsenceFilters({ employee: 'e1' });

    useBranchSelectionStore.setState({ selectedBranchId: 'b2' as BranchId });

    expect(state().employees.search).toBe('');
    expect(state().absences.employee).toBe('all');
  });
});
