import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadErrorAlert } from './LoadErrorAlert';

describe('LoadErrorAlert', () => {
  it('says the data could not be loaded and offers a retry', async () => {
    const onRetry = vi.fn();
    render(<LoadErrorAlert onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Daten konnten nicht geladen werden.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
