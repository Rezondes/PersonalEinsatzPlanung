import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { BottomTab } from './navItems';
import { BOTTOM_TABS } from './navItems';
import { BottomTabBar } from './BottomTabBar';

const label = (tab: BottomTab) => tab.shortLabel ?? tab.label;

describe('BottomTabBar', () => {
  it('marks the active tab with aria-current="page" and every other tab with none', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <BottomTabBar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: label(BOTTOM_TABS[0]) })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: label(BOTTOM_TABS[1]) })).not.toHaveAttribute('aria-current');
  });
});
