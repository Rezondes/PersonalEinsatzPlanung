import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { kalenderwocheDavor, kalenderwocheDanach, montagDerWoche, datumFuerWochentag } from '@domain/shared/Kalenderwoche';
import type { MitarbeiterId } from '@domain/shared/ids';
import { sollWochenstunden } from '@domain/mitarbeiter/Beschaeftigungsart';
import { minutenZuDezimalstunden } from '@domain/wochenplan/wochenplanBerechnung';
import { erstelleWochenAnsicht } from '@application/wochenplan/wochenplanAuswertung';
import type { TagesAnsicht } from '@application/wochenplan/wochenplanAuswertung';
import type { Tageseintrag } from '@domain/wochenplan/MitarbeiterWocheneinsatz';
import { services } from '@infrastructure/services';
import { useAusgewaehlteFiliale } from '@ui/hooks/useFiliale';
import { useMitarbeiterListe } from '@ui/hooks/useMitarbeiterListe';
import { useWochenplan } from '@ui/hooks/useWochenplan';
import { useAbwesenheiten } from '@ui/hooks/useAbwesenheiten';
import { useKalenderwocheStore } from '@ui/app/store/kalenderwocheStore';
import { useFehlerSnackbar } from '@ui/hooks/useFehlerSnackbar';
import { FehlerSnackbar } from '@ui/components/FehlerSnackbar';
import { WochenplanTabelle } from './components/WochenplanTabelle';
import { TagEditor } from './components/TagEditor';
import { ValidierungsHinweise } from './components/ValidierungsHinweise';
import { useWochenplanValidierung } from './useWochenplanValidierung';

export function WochenplanView() {
  const { filiale } = useAusgewaehlteFiliale();
  const { mitarbeiterListe } = useMitarbeiterListe(filiale?.id ?? null);
  const ausgewaehlteWoche = useKalenderwocheStore((s) => s.ausgewaehlteWoche);
  const setAusgewaehlteWoche = useKalenderwocheStore((s) => s.setAusgewaehlteWoche);
  const { plan, laedt, setPlan } = useWochenplan(filiale?.id ?? null, ausgewaehlteWoche);
  const { abwesenheiten, neuLaden: abwesenheitenNeuLaden } = useAbwesenheiten(mitarbeiterListe.map((m) => m.id));
  const validierungsErgebnisse = useWochenplanValidierung(plan, filiale, abwesenheiten);
  const navigate = useNavigate();

  const [editorZustand, setEditorZustand] = useState<{
    mitarbeiterId: MitarbeiterId;
    tagesAnsicht: TagesAnsicht;
  } | null>(null);

  const [wochenumsatzEingabe, setWochenumsatzEingabe] = useState('');
  const [wochenstundenEingabe, setWochenstundenEingabe] = useState('');
  const [kopfdatenGespeichert, setKopfdatenGespeichert] = useState(false);
  const { fehler, melden, zuruecksetzen } = useFehlerSnackbar();

  useEffect(() => {
    setWochenumsatzEingabe(plan?.geplanterWochenumsatz != null ? String(plan.geplanterWochenumsatz) : '');
    setWochenstundenEingabe(plan?.geplanteWochenstunden != null ? String(plan.geplanteWochenstunden) : '');
  }, [plan?.id, plan?.geplanterWochenumsatz, plan?.geplanteWochenstunden]);

  const planKopfdatenSpeichern = async () => {
    if (!plan) return;
    try {
      const aktualisiert = await services.wochenplan.speichern({
        ...plan,
        geplanterWochenumsatz: wochenumsatzEingabe.trim() === '' ? undefined : Number(wochenumsatzEingabe),
        geplanteWochenstunden: wochenstundenEingabe.trim() === '' ? undefined : Number(wochenstundenEingabe),
      });
      setPlan(aktualisiert);
      setKopfdatenGespeichert(true);
      setTimeout(() => setKopfdatenGespeichert(false), 2000);
    } catch (e) {
      melden(e, 'Kopfdaten konnten nicht gespeichert werden');
    }
  };

  const wochenAnsicht = useMemo(() => (plan ? erstelleWochenAnsicht(plan, abwesenheiten) : []), [plan, abwesenheiten]);

  const gesamtIstMinuten = wochenAnsicht.reduce((summe, e) => summe + e.gesamtNettoMinuten, 0);
  const gesamtSollStunden = mitarbeiterListe.reduce((summe, m) => summe + sollWochenstunden(m.beschaeftigungsart), 0);
  const anzahlAbwesend = new Set(abwesenheiten.filter((a) => wochenAnsicht.some((w) => w.mitarbeiterId === a.mitarbeiterId)).map((a) => a.mitarbeiterId)).size;

  const zelleKlick = (mitarbeiterId: MitarbeiterId, tagesAnsicht: TagesAnsicht) => {
    setEditorZustand({ mitarbeiterId, tagesAnsicht });
  };

  const eintragSpeichern = async (eintrag: Tageseintrag) => {
    if (!plan || !editorZustand) return;
    try {
      const aktualisiert = await services.wochenplan.tageseintragSetzenUndSpeichern(
        plan,
        editorZustand.mitarbeiterId,
        editorZustand.tagesAnsicht.tag,
        eintrag,
      );
      setPlan(aktualisiert);
    } catch (e) {
      melden(e, 'Eintrag konnte nicht gespeichert werden');
    }
  };

  const abwesenheitSpeichern = async (art: 'Urlaub' | 'Krankheit' | 'Sonstige', bezeichnung?: string) => {
    if (!editorZustand) return;
    const { mitarbeiterId, tagesAnsicht } = editorZustand;
    const bestehend = tagesAnsicht.abwesenheit;
    const istBestehendEinzeltag = bestehend && bestehend.von === tagesAnsicht.datum && bestehend.bis === tagesAnsicht.datum;

    try {
      // Simpler than an update across the discriminated union: replace the existing entry (if any)
      // instead of trying to migrate it type-safely between the different kinds.
      if (istBestehendEinzeltag && bestehend) {
        await services.abwesenheit.loeschen(bestehend.id);
      }

      if (art === 'Sonstige') {
        await services.abwesenheit.anlegen({
          mitarbeiterId,
          art: 'Sonstige',
          von: tagesAnsicht.datum,
          bis: tagesAnsicht.datum,
          bezeichnung: bezeichnung ?? 'Sonstige Abwesenheit',
        });
      } else {
        await services.abwesenheit.anlegen({ mitarbeiterId, art, von: tagesAnsicht.datum, bis: tagesAnsicht.datum });
      }
      await abwesenheitenNeuLaden();
    } catch (e) {
      melden(e, 'Abwesenheit konnte nicht gespeichert werden');
    }
  };

  const abwesenheitLoeschen = async () => {
    const bestehend = editorZustand?.tagesAnsicht.abwesenheit;
    if (!bestehend) return;
    try {
      await services.abwesenheit.loeschen(bestehend.id);
      await abwesenheitenNeuLaden();
    } catch (e) {
      melden(e, 'Abwesenheit konnte nicht gelöscht werden');
    }
  };

  if (!filiale) {
    return <Alert severity="info">Bitte zuerst oben eine Filiale auswählen oder anlegen.</Alert>;
  }

  const editorMitarbeiter = editorZustand ? mitarbeiterListe.find((m) => m.id === editorZustand.mitarbeiterId) : null;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={500}>
            {filiale.filialnummer} {filiale.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            KW {ausgewaehlteWoche.woche} · {montagDerWoche(ausgewaehlteWoche).toLocaleDateString('de-DE')} –{' '}
            {datumFuerWochentag(ausgewaehlteWoche, 'Sonntag').toLocaleDateString('de-DE')}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          <IconButton onClick={() => setAusgewaehlteWoche(kalenderwocheDavor(ausgewaehlteWoche))} aria-label="Vorherige Woche">
            <ChevronLeftIcon />
          </IconButton>
          <IconButton onClick={() => setAusgewaehlteWoche(kalenderwocheDanach(ausgewaehlteWoche))} aria-label="Nächste Woche">
            <ChevronRightIcon />
          </IconButton>
          {plan && (
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => navigate(`/druck/${plan.id}`)}>
              Drucken
            </Button>
          )}
        </Stack>
      </Stack>

      <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 2 }}>
        <TextField
          label="Geplanter Wochenumsatz"
          type="number"
          size="small"
          value={wochenumsatzEingabe}
          onChange={(e) => setWochenumsatzEingabe(e.target.value)}
          onBlur={planKopfdatenSpeichern}
          InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
          sx={{ width: 260 }}
        />
        <TextField
          label="Geplante Wochenstunden"
          type="number"
          size="small"
          value={wochenstundenEingabe}
          onChange={(e) => setWochenstundenEingabe(e.target.value)}
          onBlur={planKopfdatenSpeichern}
          sx={{ width: 260 }}
        />
        {kopfdatenGespeichert && (
          <Typography variant="caption" color="success.main" sx={{ alignSelf: 'center' }}>
            Gespeichert
          </Typography>
        )}
      </Stack>

      <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 3 }}>
        {[
          { label: 'Soll-Std. (Verträge)', wert: gesamtSollStunden.toLocaleString('de-DE') },
          { label: 'Ist-Wochenstd.', wert: minutenZuDezimalstunden(gesamtIstMinuten).toLocaleString('de-DE') },
          {
            label: 'Hinweise',
            wert: `${validierungsErgebnisse.filter((e) => e.schweregrad === 'fehler').length} Fehler`,
          },
          { label: 'Abwesend', wert: `${anzahlAbwesend} Mitarbeiter` },
        ].map((kachel) => (
          <Paper key={kachel.label} sx={{ p: 2, minWidth: 160, flex: '1 1 160px' }}>
            <Typography variant="caption" color="text.secondary">
              {kachel.label}
            </Typography>
            <Typography variant="h6" fontWeight={500}>
              {kachel.wert}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <ValidierungsHinweise ergebnisse={validierungsErgebnisse} mitarbeiterListe={mitarbeiterListe} />

      {!laedt && mitarbeiterListe.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Für diese Filiale sind noch keine Mitarbeiter angelegt. Lege zuerst Mitarbeiter unter „Mitarbeiter“ an.
        </Alert>
      )}

      {plan && wochenAnsicht.length > 0 && (
        <WochenplanTabelle
          wochenAnsicht={wochenAnsicht}
          mitarbeiterListe={mitarbeiterListe}
          validierungsErgebnisse={validierungsErgebnisse}
          onZelleKlick={zelleKlick}
        />
      )}

      {editorZustand && editorMitarbeiter && (
        <TagEditor
          open
          onClose={() => setEditorZustand(null)}
          onSpeichern={eintragSpeichern}
          onAbwesenheitSpeichern={abwesenheitSpeichern}
          onAbwesenheitLoeschen={abwesenheitLoeschen}
          mitarbeiterId={editorZustand.mitarbeiterId}
          mitarbeiterName={`${editorMitarbeiter.vorname} ${editorMitarbeiter.nachname}`}
          tag={editorZustand.tagesAnsicht.tag}
          datum={editorZustand.tagesAnsicht.datum}
          eintrag={editorZustand.tagesAnsicht.eintrag}
          abwesenheit={editorZustand.tagesAnsicht.abwesenheit}
        />
      )}

      <FehlerSnackbar fehler={fehler} onClose={zuruecksetzen} />
    </Box>
  );
}
