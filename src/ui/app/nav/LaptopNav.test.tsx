import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MAIN_NAV_ITEMS } from './navItems';
import { LaptopNav } from './LaptopNav';

describe('LaptopNav', () => {
  it('marks the active route with aria-current="page" and every other link with none', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <LaptopNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: MAIN_NAV_ITEMS[0].label })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: MAIN_NAV_ITEMS[1].label })).not.toHaveAttribute('aria-current');
  });
});
