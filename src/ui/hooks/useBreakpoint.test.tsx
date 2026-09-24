import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useBreakpoint, useIsShortViewport } from './useBreakpoint';

function Harness() {
  return <span>{useBreakpoint()}</span>;
}

function ShortHarness() {
  return <span>{useIsShortViewport() ? 'short' : 'tall'}</span>;
}

/** jsdom has no real layout engine, so `window.matchMedia` is mocked per test to answer as if the
 * viewport were `width` x `height` - MUI's `theme.breakpoints.up(key)` produces a `(min-width:...px)`
 * query and useIsShortViewport a `(max-height:...px)` one, which this parses back out. */
function mockViewportWidth(width: number, height = 900) {
  window.matchMedia = ((query: string) => {
    const minWidth = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const maxHeight = /max-height:\s*(\d+(?:\.\d+)?)px/.exec(query);
    return {
      matches: (!minWidth || width >= Number(minWidth[1])) && (!maxHeight || height <= Number(maxHeight[1])),
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

describe('useBreakpoint', () => {
  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('reports mobile below 1024px', () => {
    mockViewportWidth(500);
    render(<Harness />);
    expect(screen.getByText('mobile')).toBeInTheDocument();
  });

  it('reports mobile at exactly 1024px', () => {
    mockViewportWidth(1024);
    render(<Harness />);
    expect(screen.getByText('mobile')).toBeInTheDocument();
  });

  it('reports tablet from 1025px', () => {
    mockViewportWidth(1025);
    render(<Harness />);
    expect(screen.getByText('tablet')).toBeInTheDocument();
  });

  it('still reports tablet at a very wide viewport', () => {
    mockViewportWidth(2200);
    render(<Harness />);
    expect(screen.getByText('tablet')).toBeInTheDocument();
  });
});

describe('useIsShortViewport', () => {
  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('is true for a phone held sideways (780x360)', () => {
    mockViewportWidth(780, 360);
    render(<ShortHarness />);
    expect(screen.getByText('short')).toBeInTheDocument();
  });

  it('is true at exactly 500px height', () => {
    mockViewportWidth(900, 500);
    render(<ShortHarness />);
    expect(screen.getByText('short')).toBeInTheDocument();
  });

  it('is false for a phone held upright and for a tablet in landscape', () => {
    mockViewportWidth(390, 844);
    const { unmount } = render(<ShortHarness />);
    expect(screen.getByText('tall')).toBeInTheDocument();
    unmount();

    mockViewportWidth(1024, 600);
    render(<ShortHarness />);
    expect(screen.getByText('tall')).toBeInTheDocument();
  });
});
