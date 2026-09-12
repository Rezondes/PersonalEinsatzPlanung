import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useNavRailStore } from '@ui/app/store/navRailStore';
import { APP_VERSION } from '@ui/app/buildInfo';
import { MAIN_NAV_ITEMS, FOOTER_NAV_ITEMS } from './navItems';
import { NavRail } from './NavRail';

function renderRail(initialPath = '/schedule') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <NavRail />
    </MemoryRouter>,
  );
}

describe('NavRail', () => {
  beforeEach(() => {
    useNavRailStore.setState({ collapsed: false });
  });

  it('marks the active route with aria-current="page" and every other link with none', () => {
    renderRail('/schedule');

    expect(screen.getByRole('link', { name: MAIN_NAV_ITEMS[0].label })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: MAIN_NAV_ITEMS[1].label })).not.toHaveAttribute('aria-current');
  });

  it('gives every collapsed nav link an aria-label matching its full label, alongside the existing title', () => {
    useNavRailStore.setState({ collapsed: true });
    renderRail('/schedule');

    for (const item of [...MAIN_NAV_ITEMS, ...FOOTER_NAV_ITEMS]) {
      const link = screen.getByTitle(item.label);
      expect(link).toHaveAttribute('aria-label', item.label);
    }
  });

  it('gives every nav link the shared press-feedback class LaptopNav already uses', () => {
    renderRail();

    for (const item of [...MAIN_NAV_ITEMS, ...FOOTER_NAV_ITEMS]) {
      expect(screen.getByRole('link', { name: item.label })).toHaveClass('pep-nav-link');
    }
  });

  it('shows the version caption in an AA-contrast-compliant color', () => {
    renderRail();

    expect(screen.getByText(APP_VERSION)).toHaveStyle({ color: 'rgba(0, 0, 0, 0.6)' });
  });

  it('leaves an inactive link with no inline background-color, so the shared :active rule can win the cascade', () => {
    renderRail('/schedule');

    // An inline background-color (even 'transparent') always beats a class-based CSS rule for the
    // same property, so `.pep-nav-link:active` would never visibly apply while this link is
    // pressed if it were still set explicitly here - it must be genuinely absent, not just falsy.
    const inactiveLink = screen.getByRole('link', { name: MAIN_NAV_ITEMS[1].label });
    expect(inactiveLink.style.backgroundColor).toBe('');

    const activeLink = screen.getByRole('link', { name: MAIN_NAV_ITEMS[0].label });
    expect(activeLink).toHaveStyle({ backgroundColor: 'rgb(238, 243, 241)' });
  });
});
