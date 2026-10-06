import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@ui/app/theme';
import { WeekSidePanelToggle } from './WeekSidePanelToggle';
import { WEEK_SIDE_PANEL_ID } from './WeekSidePanel';

function renderToggle(props: { open?: boolean; errorCount?: number; warningCount?: number; onToggle?: () => void }) {
  const result = render(
    <ThemeProvider theme={theme}>
      <WeekSidePanelToggle
        open={props.open ?? false}
        onToggle={props.onToggle ?? (() => {})}
        errorCount={props.errorCount ?? 0}
        warningCount={props.warningCount ?? 0}
      />
    </ThemeProvider>,
  );
  return { ...result, badge: () => result.container.querySelector('.MuiBadge-badge') };
}

describe('WeekSidePanelToggle', () => {
  it('meldet aria-expanded und steuert die Leiste', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <WeekSidePanelToggle open={false} onToggle={onToggle} errorCount={0} warningCount={0} />
      </ThemeProvider>,
    );

    const closed = screen.getByRole('button', { name: 'Wochendetails anzeigen' });
    expect(closed).toHaveAttribute('aria-expanded', 'false');
    expect(closed).toHaveAttribute('aria-controls', WEEK_SIDE_PANEL_ID);
    await user.click(closed);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <ThemeProvider theme={theme}>
        <WeekSidePanelToggle open onToggle={onToggle} errorCount={0} warningCount={0} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Wochendetails ausblenden' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('Badge: Fehler vor Warnungen, sonst keins', () => {
    const errors = renderToggle({ errorCount: 2, warningCount: 3 });
    expect(screen.getByRole('button', { name: 'Wochendetails anzeigen, 2 Fehler' })).toBeInTheDocument();
    expect(errors.badge()).toHaveTextContent('2');
    expect(errors.badge()).toHaveClass('MuiBadge-colorError');
    errors.unmount();

    const warnings = renderToggle({ open: true, warningCount: 3 });
    expect(screen.getByRole('button', { name: 'Wochendetails ausblenden, 3 Warnungen' })).toBeInTheDocument();
    expect(warnings.badge()).toHaveTextContent('3');
    expect(warnings.badge()).toHaveClass('MuiBadge-colorWarning');
    warnings.unmount();

    const none = renderToggle({});
    expect(screen.getByRole('button', { name: 'Wochendetails anzeigen' })).toBeInTheDocument();
    expect(none.badge()).toBeNull();
  });
});
