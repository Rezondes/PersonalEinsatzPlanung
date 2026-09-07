import { useCallback, useEffect, useState } from 'react';
import type { FilialId } from '@domain/shared/ids';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import { services } from '@infrastructure/services';

export function useMitarbeiterListe(filialeId: FilialId | null) {
  const [mitarbeiterListe, setMitarbeiterListe] = useState<Mitarbeiter[]>([]);
  const [laedt, setLaedt] = useState(true);

  const neuLaden = useCallback(async () => {
    if (!filialeId) {
      setMitarbeiterListe([]);
      setLaedt(false);
      return;
    }
    setLaedt(true);
    const liste = await services.mitarbeiter.fuerFiliale(filialeId);
    setMitarbeiterListe(liste);
    setLaedt(false);
  }, [filialeId]);

  useEffect(() => {
    neuLaden();
  }, [neuLaden]);

  return { mitarbeiterListe, laedt, neuLaden };
}
