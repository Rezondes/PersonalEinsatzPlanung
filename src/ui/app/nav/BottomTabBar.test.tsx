import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@ui/i18n/i18n';
import type { BottomTab } from './navItems';
import { BOTTOM_TABS } from './navItems';
import { BottomTabBar } from './BottomTabBar';

const label = (tab: BottomTab) => i18n.t(tab.shortLabel ?? tab.label, { ns: 'nav' });

describe('BottomTabBar', () => {
  it('marks the active tab with aria-current="page" and every other tab with none', () => {
    render(
      <MemoryRouter initialEntries={['/de/schedule']}>
        <BottomTabBar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: label(BOTTOM_TABS[0]) })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: label(BOTTOM_TABS[1]) })).not.toHaveAttribute('aria-current');
  });

  it('drops MUI\'s 80px tab min-width so five tabs fit a 360px phone', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/de/schedule']}>
        <BottomTabBar />
      </MemoryRouter>,
    );

    const tabs = container.querySelectorAll('.MuiBottomNavigationAction-root');
    expect(tabs).toHaveLength(5);
    for (const tab of tabs) {
      expect(getComputedStyle(tab).minWidth).toBe('0');
    }
  });

  it('ist ein nav-Landmark', () => {
    render(
      <MemoryRouter initialEntries={['/de/schedule']}>
        <BottomTabBar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
