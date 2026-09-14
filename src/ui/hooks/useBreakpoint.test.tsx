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

  it('reports tablet from 768px', () => {
    mockViewportWidth(768);
    render(<Harness />);
    expect(screen.getByText('tablet')).toBeInTheDocument();
  });

  it('still reports tablet at a very wide viewport', () => {
    mockViewportWidth(2200);
    render(<Harness />);
    expect(screen.getByText('tablet')).toBeInTheDocument();
  });
});
