import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveSidePanelOpen, useWeekSidePanelStore } from './weekSidePanelStore';

describe('weekSidePanelStore', () => {
  beforeEach(() => {
    // Reset state first, clear storage second: setState() re-writes localStorage through `persist`
    // (same order as navRailStore.test.ts).
    useWeekSidePanelStore.setState({ open: null });
    localStorage.clear();
  });

  it('ist anfangs null', async () => {
    vi.resetModules();
    const fresh = await import('./weekSidePanelStore');

    expect(fresh.useWeekSidePanelStore.getState().open).toBeNull();
  });

  it('merkt sich die Wahl', async () => {
    useWeekSidePanelStore.getState().setOpen(false);

    expect(useWeekSidePanelStore.getState().open).toBe(false);
    await vi.waitFor(() => {
      const raw = localStorage.getItem('pep-week-side-panel-open');
      expect(JSON.parse(raw as string).state.open).toBe(false);
    });

    vi.resetModules();
    const fresh = await import('./weekSidePanelStore');
    expect(fresh.useWeekSidePanelStore.getState().open).toBe(false);
  });
});

describe('resolveSidePanelOpen', () => {
  it('Standard: offen ab 1600px, sonst zu', () => {
    expect(resolveSidePanelOpen(null, 1600)).toBe(true);
    expect(resolveSidePanelOpen(null, 1920)).toBe(true);
    expect(resolveSidePanelOpen(null, 1599)).toBe(false);
    expect(resolveSidePanelOpen(null, 1366)).toBe(false);
  });

  it('gespeicherte Wahl gewinnt', () => {
    expect(resolveSidePanelOpen(false, 1920)).toBe(false);
    expect(resolveSidePanelOpen(true, 1280)).toBe(true);
  });
});
