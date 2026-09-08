import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useSuppressBrowserContextMenu } from './useSuppressBrowserContextMenu';

function Harness() {
  useSuppressBrowserContextMenu();
  return (
    <div>
      <div data-testid="plain">Wochenplan</div>
      <input data-testid="field" defaultValue="Meier" />
      <p data-testid="released" data-selectable>
        Datenschutzhinweis
      </p>
      <div role="alert" data-testid="alert">
        Ruhezeit unterschritten
      </div>
    </div>
  );
}

/** Dispatches a real contextmenu event and reports whether the native menu would still appear. */
function rightClick(element: Element): boolean {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('useSuppressBrowserContextMenu', () => {
  it('suppresses the browser menu on ordinary content', () => {
    const { getByTestId } = render(<Harness />);
    expect(rightClick(getByTestId('plain'))).toBe(true);
  });

  it('leaves text fields alone, so paste by mouse keeps working', () => {
    const { getByTestId } = render(<Harness />);
    expect(rightClick(getByTestId('field'))).toBe(false);
  });

  it('leaves released prose alone', () => {
    const { getByTestId } = render(<Harness />);
    expect(rightClick(getByTestId('released'))).toBe(false);
  });

  it('leaves error messages alone, so they can be copied into a support request', () => {
    const { getByTestId } = render(<Harness />);
    expect(rightClick(getByTestId('alert'))).toBe(false);
  });

  it('covers children of a released element, not just the element itself', () => {
    const { getByTestId } = render(<Harness />);
    const child = document.createElement('em');
    getByTestId('released').appendChild(child);
    expect(rightClick(child)).toBe(false);
  });

  it('survives an event whose target has no closest(), as in a document-level dispatch', () => {
    render(<Harness />);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    expect(() => document.dispatchEvent(event)).not.toThrow();
    expect(event.defaultPrevented).toBe(true);
  });

  it('never stops propagation - the schedule view has its own listener on the same event', () => {
    const { getByTestId } = render(<Harness />);
    let sawIt = false;
    const other = () => {
      sawIt = true;
    };
    document.addEventListener('contextmenu', other);
    rightClick(getByTestId('plain'));
    document.removeEventListener('contextmenu', other);
    expect(sawIt).toBe(true);
  });

  it('removes its listener on unmount', () => {
    const { getByTestId, unmount } = render(<Harness />);
    const node = getByTestId('plain');
    document.body.appendChild(node);
    unmount();
    expect(rightClick(node)).toBe(false);
  });
});
