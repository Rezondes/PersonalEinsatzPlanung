import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import type { NavItem } from './navItems';
import { MorePage, buildMoreEntries } from './MorePage';

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

describe('buildMoreEntries', () => {
  const filialen: NavItem = { path: '/branches', label: 'branches', icon: StoreOutlinedIcon };
  const settings: NavItem = { path: '/settings', label: 'settings', icon: SettingsOutlinedIcon };

  it('puts the Filialen entry first, then the footer items, when it exists in mainNavItems', () => {
    expect(buildMoreEntries([filialen], [settings])).toEqual([filialen, settings]);
  });

  it('falls back to just the footer items, without crashing, if Filialen is missing from mainNavItems (N14)', () => {
    expect(buildMoreEntries([], [settings])).toEqual([settings]);
  });
});
