import { describe, it, expect, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useOnlineStatus } from './useOnlineStatus';

function Harness() {
  return <span>{useOnlineStatus() ? 'online' : 'offline'}</span>;
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('reports the current state on first render', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<Harness />);
    expect(screen.getByText('offline')).toBeInTheDocument();
  });

  it('reacts to losing the connection and getting it back', () => {
    render(<Harness />);
    expect(screen.getByText('online')).toBeInTheDocument();

    setOnline(false);
    expect(screen.getByText('offline')).toBeInTheDocument();

    setOnline(true);
    expect(screen.getByText('online')).toBeInTheDocument();
  });
});
