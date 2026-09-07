import { useCallback, useEffect, useState } from 'react';
import type { MitarbeiterId } from '@domain/shared/ids';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';
import { services } from '@infrastructure/services';

export function useAbwesenheiten(mitarbeiterIds: MitarbeiterId[]) {
  const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([]);
  const [laedt, setLaedt] = useState(true);
  const idsKey = mitarbeiterIds.join(',');

  const neuLaden = useCallback(async () => {
    if (mitarbeiterIds.length === 0) {
      setAbwesenheiten([]);
      setLaedt(false);
      return;
    }
    setLaedt(true);
    const liste = await services.abwesenheit.fuerFiliale(mitarbeiterIds);
    setAbwesenheiten(liste);
    setLaedt(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    neuLaden();
  }, [neuLaden]);

  return { abwesenheiten, laedt, neuLaden };
}
