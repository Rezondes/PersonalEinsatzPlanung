import { describe, it, expect } from 'vitest';
import { feiertageFuerJahrUndBundesland, erstelleFeiertagsPruefung } from './feiertageDeutschland';

describe('feiertageFuerJahrUndBundesland', () => {
  it('berechnet die beweglichen (Oster-basierten) Feiertage korrekt für bekannte Jahre', () => {
    // Easter Sunday: 2024-03-31, 2025-04-20, 2026-04-05 (publicly known reference values)
    const f2024 = feiertageFuerJahrUndBundesland(2024, 'Niedersachsen');
    expect(f2024.has('2024-03-29')).toBe(true); // Good Friday
    expect(f2024.has('2024-04-01')).toBe(true); // Easter Monday
    expect(f2024.has('2024-05-09')).toBe(true); // Ascension Day
    expect(f2024.has('2024-05-20')).toBe(true); // Whit Monday

    const f2025 = feiertageFuerJahrUndBundesland(2025, 'Niedersachsen');
    expect(f2025.has('2025-04-18')).toBe(true); // Good Friday
    expect(f2025.has('2025-04-21')).toBe(true); // Easter Monday

    const f2026 = feiertageFuerJahrUndBundesland(2026, 'Niedersachsen');
    expect(f2026.has('2026-04-03')).toBe(true); // Good Friday
    expect(f2026.has('2026-04-06')).toBe(true); // Easter Monday
  });

  it('enthält die bundesweiten festen Feiertage', () => {
    const feiertage = feiertageFuerJahrUndBundesland(2026, 'Bayern');
    expect(feiertage.has('2026-01-01')).toBe(true);
    expect(feiertage.has('2026-05-01')).toBe(true);
    expect(feiertage.has('2026-10-03')).toBe(true);
    expect(feiertage.has('2026-12-25')).toBe(true);
    expect(feiertage.has('2026-12-26')).toBe(true);
  });

  it('berücksichtigt landesspezifische Feiertage nur im jeweiligen Bundesland', () => {
    expect(feiertageFuerJahrUndBundesland(2026, 'Bayern').has('2026-01-06')).toBe(true); // Epiphany
    expect(feiertageFuerJahrUndBundesland(2026, 'Niedersachsen').has('2026-01-06')).toBe(false);

    expect(feiertageFuerJahrUndBundesland(2026, 'Niedersachsen').has('2026-10-31')).toBe(true); // Reformation Day
    expect(feiertageFuerJahrUndBundesland(2026, 'Bayern').has('2026-10-31')).toBe(false);
  });
});

describe('erstelleFeiertagsPruefung', () => {
  it('liefert eine funktionierende, gecachte istFeiertag-Funktion', () => {
    const istFeiertag = erstelleFeiertagsPruefung('Niedersachsen');
    expect(istFeiertag('2026-01-01')).toBe(true);
    expect(istFeiertag('2026-01-02')).toBe(false);
    expect(istFeiertag('2026-12-25')).toBe(true);
  });
});
