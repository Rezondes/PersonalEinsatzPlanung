import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequiredLegend } from './RequiredLegend';

describe('RequiredLegend', () => {
  it('explains the asterisk as plain text, not as an alert or status', () => {
    render(<RequiredLegend />);

    expect(screen.getByText('* Pflichtfeld')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
