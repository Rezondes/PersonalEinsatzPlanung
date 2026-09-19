import { describe, it, expect } from 'vitest';
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
});
