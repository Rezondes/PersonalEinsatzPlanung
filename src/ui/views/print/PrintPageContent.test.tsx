import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { PrintPageContent } from './PrintPageContent';

const PAGE_CONTENT_HEIGHT_PX = Math.floor((((210 - 2 * 6) / 25.4) * 96 - 16) * 0.88);

function stubScrollHeights(...heights: number[]) {
  let readCount = 0;
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => {
      const value = heights[Math.min(readCount, heights.length - 1)];
      readCount += 1;
      return value;
    },
  });
}

function printScale(container: HTMLElement) {
  return (container.firstElementChild as HTMLElement).style.getPropertyValue('--print-scale');
}

afterEach(() => {
  delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
});

describe('PrintPageContent', () => {
  it('renders its children', () => {
    stubScrollHeights(100);
    const { getByText } = render(
      <PrintPageContent>
        <div>Wochenplan</div>
      </PrintPageContent>,
    );

    expect(getByText('Wochenplan')).toBeInTheDocument();
  });

  it('does not set --print-scale when content fits on one page', () => {
    stubScrollHeights(PAGE_CONTENT_HEIGHT_PX);
    const { container } = render(
      <PrintPageContent>
        <div>Inhalt</div>
      </PrintPageContent>,
    );

    expect(printScale(container)).toBe('');
  });

  it('removes a previously-set --print-scale once content shrinks back under the page height', () => {
    stubScrollHeights(PAGE_CONTENT_HEIGHT_PX + 100, PAGE_CONTENT_HEIGHT_PX);
    const { container, rerender } = render(
      <PrintPageContent>
        <div>Viel Inhalt</div>
      </PrintPageContent>,
    );
    expect(printScale(container)).not.toBe('');

    stubScrollHeights(PAGE_CONTENT_HEIGHT_PX - 1);
    rerender(
      <PrintPageContent>
        <div>Wenig Inhalt</div>
      </PrintPageContent>,
    );

    expect(printScale(container)).toBe('');
  });

  it('scales overflowing content to threshold/scrollHeight when one pass already fits', () => {
    stubScrollHeights(PAGE_CONTENT_HEIGHT_PX + 156, PAGE_CONTENT_HEIGHT_PX - 4);
    const { container } = render(
      <PrintPageContent>
        <div>Inhalt</div>
      </PrintPageContent>,
    );

    const expectedScale = PAGE_CONTENT_HEIGHT_PX / (PAGE_CONTENT_HEIGHT_PX + 156);
    const scale = Number(printScale(container));
    expect(scale).toBeLessThan(1);
    expect(scale).toBeCloseTo(expectedScale, 10);
  });

  it('applies a corrective second adjustment when the first pass still overflows', () => {
    const naturalHeight = PAGE_CONTENT_HEIGHT_PX + 156;
    const afterFirstPass = PAGE_CONTENT_HEIGHT_PX + 36;
    stubScrollHeights(naturalHeight, afterFirstPass);
    const { container } = render(
      <PrintPageContent>
        <div>Dichte Tabelle</div>
      </PrintPageContent>,
    );

    const naiveScale = PAGE_CONTENT_HEIGHT_PX / naturalHeight;
    const expectedScale = naiveScale * (PAGE_CONTENT_HEIGHT_PX / afterFirstPass);
    const scale = Number(printScale(container));
    expect(scale).toBeLessThan(1);
    expect(scale).toBeCloseTo(expectedScale, 10);
    expect(scale).toBeLessThan(naiveScale);
  });

  it('re-measures on the beforeprint event and reflects the new height', () => {
    stubScrollHeights(PAGE_CONTENT_HEIGHT_PX - 10);
    const { container } = render(
      <PrintPageContent>
        <div>Inhalt</div>
      </PrintPageContent>,
    );
    expect(printScale(container)).toBe('');

    stubScrollHeights(PAGE_CONTENT_HEIGHT_PX + 156, PAGE_CONTENT_HEIGHT_PX - 4);
    window.dispatchEvent(new Event('beforeprint'));

    const expectedScale = PAGE_CONTENT_HEIGHT_PX / (PAGE_CONTENT_HEIGHT_PX + 156);
    expect(Number(printScale(container))).toBeCloseTo(expectedScale, 10);
  });

  it('removes the beforeprint listener on unmount, so a later print event no longer touches it', () => {
    stubScrollHeights(PAGE_CONTENT_HEIGHT_PX - 10);
    const { container, unmount } = render(
      <PrintPageContent>
        <div>Inhalt</div>
      </PrintPageContent>,
    );
    const contentEl = container.firstElementChild as HTMLElement;
    expect(contentEl.style.getPropertyValue('--print-scale')).toBe('');

    unmount();

    stubScrollHeights(PAGE_CONTENT_HEIGHT_PX + 156, PAGE_CONTENT_HEIGHT_PX - 4);
    window.dispatchEvent(new Event('beforeprint'));

    expect(contentEl.style.getPropertyValue('--print-scale')).toBe('');
  });

  it('registers and removes the exact same beforeprint handler instance, not a mismatched pair', () => {
    stubScrollHeights(PAGE_CONTENT_HEIGHT_PX - 10);
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(
      <PrintPageContent>
        <div>Inhalt</div>
      </PrintPageContent>,
    );

    unmount();

    const addedHandler = addEventListenerSpy.mock.calls.find(([event]) => event === 'beforeprint')?.[1];
    const removedHandler = removeEventListenerSpy.mock.calls.find(([event]) => event === 'beforeprint')?.[1];
    expect(addedHandler).toBeInstanceOf(Function);
    expect(removedHandler).toBe(addedHandler);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
