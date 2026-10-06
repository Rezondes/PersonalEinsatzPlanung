import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeading } from './PageHeading';

describe('PageHeading', () => {
  it('rendert ein visuell verstecktes h1', () => {
    render(<PageHeading>Mitarbeiter</PageHeading>);

    expect(screen.getByRole('heading', { level: 1, name: 'Mitarbeiter' })).toHaveStyle({
      position: 'absolute',
      width: '1px',
    });
  });
});
