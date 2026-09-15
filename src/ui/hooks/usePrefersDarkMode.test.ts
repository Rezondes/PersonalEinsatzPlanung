import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePrefersDarkMode } from './usePrefersDarkMode';

/** A minimal fake MediaQueryList - jsdom's real matchMedia never matches anything and fires no
 * events, so `(prefers-color-scheme: dark)` needs to be stubbed the same way useBreakpoint.test.tsx
 * stubs width-based queries, but this one also needs a working addEventListener/dispatch pair since
 * the hook must react to a live OS-level change, not just read a snapshot once. */
function stubPrefersDark(initial: boolean) {
  let matches = initial;
  const listeners = new Set<(e: { matches: boolean }) => void>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: (e: { matches: boolean }) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (e: { matches: boolean }) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  return {
    setMatches(value: boolean) {
      matches = value;
      listeners.forEach((listener) => listener({ matches: value }));
    },
  };
}

describe('usePrefersDarkMode', () => {
  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('reports true when the OS prefers dark mode', () => {
    stubPrefersDark(true);

    const { result } = renderHook(() => usePrefersDarkMode());

    expect(result.current).toBe(true);
  });

  it('reports false when the OS does not prefer dark mode', () => {
    stubPrefersDark(false);

    const { result } = renderHook(() => usePrefersDarkMode());

    expect(result.current).toBe(false);
  });

  it('updates when the OS preference changes while mounted', () => {
    const control = stubPrefersDark(false);
    const { result } = renderHook(() => usePrefersDarkMode());
    expect(result.current).toBe(false);

    act(() => control.setMatches(true));

    expect(result.current).toBe(true);
  });
});
