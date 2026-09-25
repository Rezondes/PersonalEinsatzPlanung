import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@ui/app/theme';
import { PanZoomContainer } from './PanZoomContainer';

function renderPanZoom() {
  return render(
    <ThemeProvider theme={theme}>
      <PanZoomContainer>
        <div>Inhalt</div>
      </PanZoomContainer>
    </ThemeProvider>,
  );
}

function content(): HTMLElement {
  return screen.getByTestId('panzoom-content');
}

/** MUI's `sx` bakes a dynamic value like this transform into an Emotion-generated class, not an
 * inline `style=""` attribute - `.style.transform` reads back empty even though the rule is
 * genuinely applied. `getComputedStyle` (what jest-dom's toHaveStyle uses) is what actually
 * resolves it, same as every other MUI-driven style assertion elsewhere in this codebase. */
function expectTransform(x: number, y: number, scale: number) {
  expect(content()).toHaveStyle({ transform: `translate(${x}px, ${y}px) scale(${scale})` });
}

describe('PanZoomContainer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Teil 8, Package 13: React registers onWheel as passive, so its preventDefault did nothing and a
  // trackpad pinch zoomed the whole page along with the preview.
  it('registers its wheel listener as non-passive', () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    renderPanZoom();

    expect(add).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
  });

  // Teil 8, Package 13: zoom and pan needed a wheel, a drag or a pinch - nothing for the keyboard.
  it('zooms in and out with buttons', () => {
    renderPanZoom();

    fireEvent.click(screen.getByRole('button', { name: 'Vergrößern' }));
    expectTransform(0, 0, 1.25);
    fireEvent.click(screen.getByRole('button', { name: 'Verkleinern' }));
    expectTransform(0, 0, 1);
  });

  it('zooms and pans from the keyboard on the focusable preview', () => {
    renderPanZoom();
    const region = screen.getByRole('region', { name: 'Druckvorschau' });

    fireEvent.keyDown(region, { key: '+' });
    expectTransform(0, 0, 1.25);
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    expectTransform(-40, -40, 1.25);
    fireEvent.keyDown(region, { key: '0' });
    expectTransform(0, 0, 1);
    expect(region).toHaveAttribute('tabindex', '0');
  });

  // Teil 8, Package 13: at 375px the 297mm sheet opened at scale 1, a third of it in view.
  it('opens scaled to fit the width, and resets back to that', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(375);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1123);
    renderPanZoom();
    const fit = (375 - 16) / 1123;

    expectTransform(0, 0, fit);
    fireEvent.wheel(content(), { deltaY: -200 });
    fireEvent.click(screen.getByRole('button', { name: 'Ansicht zurücksetzen' }));
    expectTransform(0, 0, fit);
  });
  it('renders children with a CSS transform reflecting the initial (untouched) zoom/pan state', () => {
    renderPanZoom();

    expect(screen.getByText('Inhalt')).toBeInTheDocument();
    expectTransform(0, 0, 1);
  });

  it('a wheel event changes the scale on the inner container, clamped to sensible min/max limits', () => {
    renderPanZoom();

    fireEvent.wheel(content(), { deltaY: -200 });
    expectTransform(0, 0, 1.2);

    // Far past the upper bound - must clamp, not run away unbounded.
    fireEvent.wheel(content(), { deltaY: -100000 });
    expectTransform(0, 0, 3);

    // Far past the lower bound - must clamp there too.
    fireEvent.wheel(content(), { deltaY: 100000 });
    expectTransform(0, 0, 0.25);
  });

  it('a mouse drag changes the translate() position on the inner container', () => {
    renderPanZoom();

    fireEvent.mouseDown(content(), { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 140, clientY: 125 });

    expectTransform(40, 25, 1);

    fireEvent.mouseUp(window);
    // Further movement after mouseup must not keep dragging.
    fireEvent.mouseMove(window, { clientX: 500, clientY: 500 });
    expectTransform(40, 25, 1);
  });

  it('Zurücksetzen restores zoom to 1 and position to 0/0 after zooming and panning', () => {
    renderPanZoom();

    fireEvent.wheel(content(), { deltaY: -200 });
    fireEvent.mouseDown(content(), { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 30, clientY: 30 });
    fireEvent.mouseUp(window);
    expectTransform(30, 30, 1.2);

    fireEvent.click(screen.getByRole('button', { name: 'Ansicht zurücksetzen' }));

    expectTransform(0, 0, 1);
  });

  it('a one-finger touch drag changes the translate() position, same as a mouse drag', () => {
    renderPanZoom();

    fireEvent.touchStart(content(), { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(window, { touches: [{ clientX: 140, clientY: 125 }] });

    expectTransform(40, 25, 1);

    fireEvent.touchEnd(window);
    // Further movement after touchend must not keep dragging.
    fireEvent.touchMove(window, { touches: [{ clientX: 500, clientY: 500 }] });
    expectTransform(40, 25, 1);
  });

  it('a two-finger pinch changes the scale, clamped to the same limits as the wheel', () => {
    renderPanZoom();

    // Starting distance 100px (100,100)-(200,100).
    fireEvent.touchStart(content(), {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    });
    // Distance grows to 150px - 1.5x the starting distance.
    fireEvent.touchMove(window, {
      touches: [
        { clientX: 75, clientY: 100 },
        { clientX: 225, clientY: 100 },
      ],
    });
    expectTransform(0, 0, 1.5);

    // Far past the upper bound (distance grown ~30x from the start) - must clamp, not run away.
    fireEvent.touchMove(window, {
      touches: [
        { clientX: 0, clientY: 100 },
        { clientX: 3000, clientY: 100 },
      ],
    });
    expectTransform(0, 0, 3);
  });

  it('touchend stops the drag, further touchmove has no effect', () => {
    renderPanZoom();

    fireEvent.touchStart(content(), { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(window, { touches: [{ clientX: 20, clientY: 10 }] });
    expectTransform(20, 10, 1);

    fireEvent.touchEnd(window);
    fireEvent.touchMove(window, { touches: [{ clientX: 200, clientY: 200 }] });
    expectTransform(20, 10, 1);
  });

  it('the content element opts out of native touch gestures (touch-action: none)', () => {
    // jsdom's CSSOM does not implement touch-action at all (confirmed: even a direct
    // `el.style.touchAction = 'none'` produces an empty cssText), so getComputedStyle/toHaveStyle
    // can never see it here regardless of what's actually applied - same class of jsdom gap as the
    // Table width:'auto' case documented in ScheduleTable.tsx's file header. Emotion's injected
    // stylesheet text is the only thing in this environment that can confirm the rule was generated.
    renderPanZoom();

    const styleText = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent)
      .join('\n');
    expect(styleText).toMatch(/touch-action:\s*none/);
  });
});
