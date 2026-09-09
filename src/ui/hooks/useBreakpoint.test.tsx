import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useBreakpoint } from './useBreakpoint';

function Harness() {
  return <span>{useBreakpoint()}</span>;
}

/** jsdom has no real layout engine, so `window.matchMedia` is mocked per test to answer as if the
 * viewport were `width` wide - MUI's `theme.breakpoints.up(key)` produces a `(min-width:...px)`
 * query, which this parses back out. */
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

describe('useBreakpoint', () => {
  afterEach(() => {
    // @ts-expect-error -- undo the per-test stub, jsdom has no matchMedia of its own to restore
    delete window.matchMedia;
  });

  it('reports mobile below 768px', () => {
    mockViewportWidth(500);
    render(<Harness />);
    expect(screen.getByText('mobile')).toBeInTheDocument();
  });

  it('reports tabletPortrait from 768px', () => {
    mockViewportWidth(800);
    render(<Harness />);
    expect(screen.getByText('tabletPortrait')).toBeInTheDocument();
  });

  it('reports tabletLandscape from 1024px', () => {
    mockViewportWidth(1100);
    render(<Harness />);
    expect(screen.getByText('tabletLandscape')).toBeInTheDocument();
  });

  it('reports laptop from 1280px', () => {
    mockViewportWidth(1400);
    render(<Harness />);
    expect(screen.getByText('laptop')).toBeInTheDocument();
  });
});
