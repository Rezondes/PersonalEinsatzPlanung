import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { WochenplanId } from '@domain/shared/ids';
import type { Wochenplan } from '@domain/wochenplan/Wochenplan';
import type { Filiale } from '@domain/filiale/Filiale';
import type { Mitarbeiter } from '@domain/mitarbeiter/Mitarbeiter';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';
import { bereiteDruckDatenAuf } from '@application/export/druckDatenAufbereitung';
import { services } from '@infrastructure/services';
import { FormularVollTeilzeit } from './print/FormularVollTeilzeit';
import { FormularMinijob } from './print/FormularMinijob';
import './print/druckansicht.css';

const MITARBEITER_PRO_BLATT = 9;

function inGruppenAufteilen<T>(liste: T[], groesse: number): T[][] {
  const gruppen: T[][] = [];
  for (let i = 0; i < liste.length; i += groesse) {
    gruppen.push(liste.slice(i, i + groesse));
  }
  return gruppen;
}

export function DruckvorschauView() {
  const { wochenplanId } = useParams<{ wochenplanId: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Wochenplan | null>(null);
  const [filiale, setFiliale] = useState<Filiale | null>(null);
  const [mitarbeiterListe, setMitarbeiterListe] = useState<Mitarbeiter[]>([]);
  const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([]);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    (async () => {
      if (!wochenplanId) return;
      const geladenerPlan = await services.wochenplan.finden(wochenplanId as WochenplanId);
      if (!geladenerPlan) {
        setLaedt(false);
        return;
      }
      const [geladeneFiliale, geladeneMitarbeiter] = await Promise.all([
        services.filiale.finden(geladenerPlan.filialeId),
        services.mitarbeiter.fuerFiliale(geladenerPlan.filialeId),
      ]);
      const geladeneAbwesenheiten = await services.abwesenheit.fuerFiliale(geladeneMitarbeiter.map((m) => m.id));

      setPlan(geladenerPlan);
      setFiliale(geladeneFiliale);
      setMitarbeiterListe(geladeneMitarbeiter);
      setAbwesenheiten(geladeneAbwesenheiten);
      setLaedt(false);
    })();
  }, [wochenplanId]);

  if (laedt) {
    return null;
  }

  if (!plan || !filiale) {
    return <Alert severity="error">Wochenplan konnte nicht gefunden werden.</Alert>;
  }

  const { vollTeilzeitZeilen, minijobZeilen, tagessummen } = bereiteDruckDatenAuf(plan, mitarbeiterListe, abwesenheiten);
  const vollTeilzeitSeiten = inGruppenAufteilen(vollTeilzeitZeilen, MITARBEITER_PRO_BLATT);
  const minijobSeiten = inGruppenAufteilen(minijobZeilen, MITARBEITER_PRO_BLATT);

  return (
    <Box>
      <Stack direction="row" gap={2} className="druck-aktionsleiste" sx={{ p: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Zurück
        </Button>
        <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
          Drucken
        </Button>
      </Stack>

      {vollTeilzeitSeiten.map((seite, index) => (
        <FormularVollTeilzeit
          key={`vt-${index}`}
          filiale={filiale}
          kalenderwoche={plan.kalenderwoche}
          geplanterWochenumsatz={plan.geplanterWochenumsatz}
          geplanteWochenstunden={plan.geplanteWochenstunden}
          zeilen={seite}
          tagessummen={tagessummen}
        />
      ))}

      {minijobSeiten.map((seite, index) => (
        <FormularMinijob
          key={`mj-${index}`}
          filiale={filiale}
          kalenderwoche={plan.kalenderwoche}
          zeilen={seite}
          tagessummen={tagessummen}
        />
      ))}
    </Box>
  );
}
