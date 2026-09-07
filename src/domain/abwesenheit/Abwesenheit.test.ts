import { describe, it, expect } from 'vitest';
import type { MitarbeiterId } from '@domain/shared/ids';
import { DomainError } from '@domain/shared/DomainError';
import { neueAbwesenheit } from './Abwesenheit';

const m1 = 'm1' as MitarbeiterId;

describe('neueAbwesenheit', () => {
  it('erstellt eine gültige Abwesenheit mit id und erstelltAm', () => {
    const abwesenheit = neueAbwesenheit({ mitarbeiterId: m1, art: 'Urlaub', von: '2026-09-07', bis: '2026-09-11' });
    expect(abwesenheit.id).toBeTruthy();
    expect(abwesenheit.erstelltAm).toBeTruthy();
    expect(abwesenheit.von).toBe('2026-09-07');
    expect(abwesenheit.bis).toBe('2026-09-11');
  });

  it('erlaubt einen einzelnen Tag (von === bis)', () => {
    expect(() => neueAbwesenheit({ mitarbeiterId: m1, art: 'Krankheit', von: '2026-09-07', bis: '2026-09-07' })).not.toThrow();
  });

  it('lehnt bis vor von ab', () => {
    expect(() =>
      neueAbwesenheit({ mitarbeiterId: m1, art: 'Urlaub', von: '2026-09-11', bis: '2026-09-07' }),
    ).toThrow(DomainError);
  });
});
