import { describe, it, expect, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useTapTooltip } from './useTapTooltip';

/** Copied from useBreakpoint.test.tsx: jsdom has no real layout engine, so window.matchMedia is
 * mocked to answer as if the viewport were `width` wide. */
function mockViewportWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const match = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const minWidth = match ? Number(match[1]) : 0;
    return {
      matches: width >= minWidth,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

let harness: ReturnType<typeof useTapTooltip> | null = null;

function Harness() {
  harness = useTapTooltip();
  return null;
}

function renderHarness() {
  harness = null;
  render(<Harness />);
}

describe('useTapTooltip', () => {
  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('disables hover at mobile width, enables it from tablet width up', () => {
    mockViewportWidth(500);
    renderHarness();
    expect(harness!.tooltipProps('a').disableHoverListener).toBe(true);

    mockViewportWidth(1024);
    renderHarness();
    expect(harness!.tooltipProps('a').disableHoverListener).toBe(false);
  });

  it('toggles between keys and closes on a repeated toggle, never two keys open at once', () => {
    renderHarness();

    act(() => harness!.toggle('a'));
    expect(harness!.tooltipProps('a').open).toBe(true);
    expect(harness!.tooltipProps('b').open).toBe(false);

    act(() => harness!.toggle('b'));
    expect(harness!.tooltipProps('a').open).toBe(false);
    expect(harness!.tooltipProps('b').open).toBe(true);

    act(() => harness!.toggle('b'));
    expect(harness!.tooltipProps('a').open).toBe(false);
    expect(harness!.tooltipProps('b').open).toBe(false);
  });

  it('close(key) clears state only when that key is the one currently open', () => {
    renderHarness();

    act(() => harness!.toggle('a'));
    expect(harness!.tooltipProps('a').open).toBe(true);

    // A different key's close() must be a no-op - this is what keeps one tooltip's own
    // ClickAwayListener from clobbering a DIFFERENT tooltip that a click just opened.
    act(() => harness!.close('b'));
    expect(harness!.tooltipProps('a').open).toBe(true);

    act(() => harness!.close('a'));
    expect(harness!.tooltipProps('a').open).toBe(false);
  });
});
