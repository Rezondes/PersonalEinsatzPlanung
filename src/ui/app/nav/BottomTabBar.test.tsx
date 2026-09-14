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
});
