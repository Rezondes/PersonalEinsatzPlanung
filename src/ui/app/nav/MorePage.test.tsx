import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MorePage } from './MorePage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/more']}>
      <MorePage />
    </MemoryRouter>,
  );
}

describe('MorePage', () => {
  it('renders "Mehr" as the page\'s top-level heading (N26)', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Mehr' })).toBeInTheDocument();
  });

  it('lists Filialen plus the footer nav destinations as navigable entries', () => {
    renderPage();
    expect(screen.getByText('Filialen')).toBeInTheDocument();
    expect(screen.getByText('Änderungen')).toBeInTheDocument();
    expect(screen.getByText('Datenschutz')).toBeInTheDocument();
    expect(screen.getByText('Nutzungsbedingungen')).toBeInTheDocument();
    expect(screen.getByText('Einstellungen')).toBeInTheDocument();
  });
});
