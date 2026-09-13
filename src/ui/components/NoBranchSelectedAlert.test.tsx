import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NoBranchSelectedAlert } from './NoBranchSelectedAlert';

describe('NoBranchSelectedAlert', () => {
  it('shows the message and a working link to the Filialen page (N19)', () => {
    render(
      <MemoryRouter>
        <NoBranchSelectedAlert />
      </MemoryRouter>,
    );

    expect(screen.getByText('Bitte zuerst oben eine Filiale auswählen oder anlegen.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Zu den Filialen' });
    expect(link).toHaveAttribute('href', '/branches');
  });
});
