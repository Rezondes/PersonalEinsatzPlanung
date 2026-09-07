import { useEffect } from 'react';
import { useFilialenStore } from '@ui/app/store/filialenStore';
import { useFilialeAuswahlStore } from '@ui/app/store/filialeAuswahlStore';

export function useFilialenListe() {
  const filialen = useFilialenStore((s) => s.filialen);
  const laedt = useFilialenStore((s) => s.laedt);
  const geladen = useFilialenStore((s) => s.geladen);
  const neuLaden = useFilialenStore((s) => s.neuLaden);
  const ausgewaehlteFilialeId = useFilialeAuswahlStore((s) => s.ausgewaehlteFilialeId);
  const setAusgewaehlteFiliale = useFilialeAuswahlStore((s) => s.setAusgewaehlteFiliale);

  useEffect(() => {
    if (!geladen) {
      neuLaden();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geladen]);

  useEffect(() => {
    if (!ausgewaehlteFilialeId && filialen.length > 0) {
      setAusgewaehlteFiliale(filialen[0].id);
    } else if (ausgewaehlteFilialeId && !filialen.some((f) => f.id === ausgewaehlteFilialeId) && filialen.length > 0) {
      // previously selected Filiale no longer exists in the list (e.g. deactivated while filtered out elsewhere)
      setAusgewaehlteFiliale(filialen[0].id);
    }
  }, [filialen, ausgewaehlteFilialeId, setAusgewaehlteFiliale]);

  return { filialen, laedt, neuLaden };
}

export function useAusgewaehlteFiliale() {
  const { filialen, laedt, neuLaden } = useFilialenListe();
  const ausgewaehlteFilialeId = useFilialeAuswahlStore((s) => s.ausgewaehlteFilialeId);
  const filiale = filialen.find((f) => f.id === ausgewaehlteFilialeId) ?? null;
  return { filiale, filialen, laedt, neuLaden };
}
