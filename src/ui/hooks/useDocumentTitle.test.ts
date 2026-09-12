import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentTitle } from './useDocumentTitle';

describe('useDocumentTitle', () => {
  it('sets document.title to the given value plus the shared app-name suffix', () => {
    renderHook(() => useDocumentTitle('Abwesenheiten'));

    expect(document.title).toBe('Abwesenheiten - Personaleinsatzplanung');
  });

  it('falls back to the bare app name when no title is given', () => {
    renderHook(() => useDocumentTitle(undefined));

    expect(document.title).toBe('Personaleinsatzplanung');
  });

  it('updates document.title again when the value changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Wochenplanung' as string | undefined },
    });
    expect(document.title).toBe('Wochenplanung - Personaleinsatzplanung');

    rerender({ title: 'Monatsübersicht' });

    expect(document.title).toBe('Monatsübersicht - Personaleinsatzplanung');
  });
});
