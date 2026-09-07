import { useCallback, useEffect, useState } from 'react';
import type { FilialId } from '@domain/shared/ids';
import type { Kalenderwoche } from '@domain/shared/Kalenderwoche';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import { services } from '@infrastructure/services';

export function useWochenplan(filialeId: FilialId | null, kw: Kalenderwoche) {
  const [plan, setPlan] = useState<Wochenplan | null>(null);
  const [laedt, setLaedt] = useState(true);

  const neuLaden = useCallback(async () => {
    if (!filialeId) {
      setPlan(null);
      setLaedt(false);
      return;
    }
    setLaedt(true);
    const geladen = await services.wochenplan.getOderErstelle(filialeId, kw);
    setPlan(geladen);
    setLaedt(false);
    // kw.jahr/kw.woche instead of kw itself: Kalenderwoche is created as a new object on every render,
    // a reference comparison would re-trigger the effect chain on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filialeId, kw.jahr, kw.woche]);

  useEffect(() => {
    neuLaden();
  }, [neuLaden]);

  return { plan, laedt, neuLaden, setPlan };
}
