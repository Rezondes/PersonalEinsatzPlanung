import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import type { Schicht } from '@domain/wochenplan/Schicht';
import { neueSchicht } from '@domain/wochenplan/Schicht';
import { neuePause } from '@domain/wochenplan/Pause';
import { parseUhrzeit, uhrzeit } from '@domain/shared/Uhrzeit';
import type { Tageseintrag } from '@domain/wochenplan/MitarbeiterWocheneinsatz';
import { schichtNettoMinuten, minutenZuDezimalstunden } from '@domain/wochenplan/wochenplanBerechnung';
import type { Abwesenheit } from '@domain/abwesenheit/Abwesenheit';
import type { MitarbeiterId } from '@domain/shared/ids';
import { validierePausen } from '@domain/validierung/arbeitszeitgesetz/pausenValidierung';
import { validiereSchichtdauer } from '@domain/validierung/arbeitszeitgesetz/schichtdauerValidierung';
import { validiereTagesarbeitszeit } from '@domain/validierung/arbeitszeitgesetz/hoechstarbeitszeitValidierung';
import { BestaetigungsDialog } from '@ui/components/BestaetigungsDialog';

type Modus = 'Frei' | 'Schicht' | 'Urlaub' | 'Krankheit' | 'Sonstige';

interface TagEditorProps {
  open: boolean;
  onClose: () => void;
  onSpeichern: (eintrag: Tageseintrag) => void;
  onAbwesenheitSpeichern: (art: 'Urlaub' | 'Krankheit' | 'Sonstige', bezeichnung?: string) => void;
  onAbwesenheitLoeschen: () => void;
  mitarbeiterId: MitarbeiterId;
  mitarbeiterName: string;
  tag: string;
  datum: string;
  eintrag: Tageseintrag;
  abwesenheit?: Abwesenheit;
}

export function TagEditor({
  open,
  onClose,
  onSpeichern,
  onAbwesenheitSpeichern,
  onAbwesenheitLoeschen,
  mitarbeiterId,
  mitarbeiterName,
  tag,
  datum,
  eintrag,
  abwesenheit,
}: TagEditorProps) {
  const [modus, setModus] = useState<Modus>('Frei');
  const [schichten, setSchichten] = useState<Schicht[]>([]);
  const [bezeichnung, setBezeichnung] = useState('');
  const [zeigeBestaetigung, setZeigeBestaetigung] = useState(false);

  const istEinzeltagigeAbwesenheit = !!abwesenheit && abwesenheit.von === datum && abwesenheit.bis === datum;
  const istMehrtaegigeAbwesenheit = !!abwesenheit && !istEinzeltagigeAbwesenheit;

  useEffect(() => {
    if (!open) return;

    if (istEinzeltagigeAbwesenheit && abwesenheit) {
      setModus(abwesenheit.art);
      setBezeichnung(abwesenheit.art === 'Sonstige' ? abwesenheit.bezeichnung : '');
      setSchichten(eintrag.typ === 'Schicht' ? eintrag.schichten.map((s) => ({ ...s, pausen: [...s.pausen] })) : []);
    } else if (eintrag.typ === 'Schicht' && eintrag.schichten.length > 0) {
      setModus('Schicht');
      setSchichten(eintrag.schichten.map((s) => ({ ...s, pausen: [...s.pausen] })));
      setBezeichnung('');
    } else {
      // Free day: suggest Arbeitszeit (work time) with a default shift right away instead of
      // showing "Frei" first, saving a click for new entries. If the user cancels, the day stays
      // free since nothing is saved here.
      setModus('Schicht');
      setSchichten([neueSchicht(uhrzeit('06:00'), uhrzeit('14:00'))]);
      setBezeichnung('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eintrag, abwesenheit, datum, istEinzeltagigeAbwesenheit]);

  const schichtHinzufuegen = () => {
    setSchichten((liste) => [...liste, neueSchicht(parseUhrzeit('06:00')!, parseUhrzeit('14:00')!)]);
  };

  const schichtEntfernen = (id: string) => {
    setSchichten((liste) => liste.filter((s) => s.id !== id));
  };

  const schichtAendern = (id: string, aenderung: Partial<Schicht>) => {
    setSchichten((liste) => liste.map((s) => (s.id === id ? { ...s, ...aenderung } : s)));
  };

  const pauseHinzufuegen = (schichtId: string) => {
    setSchichten((liste) =>
      liste.map((s) => (s.id === schichtId ? { ...s, pausen: [...s.pausen, neuePause(30)] } : s)),
    );
  };

  const pauseEntfernen = (schichtId: string, pauseId: string) => {
    setSchichten((liste) =>
      liste.map((s) => (s.id === schichtId ? { ...s, pausen: s.pausen.filter((p) => p.id !== pauseId) } : s)),
    );
  };

  const pauseAendern = (schichtId: string, pauseId: string, aenderung: { dauerMinuten?: number; beginn?: string }) => {
    setSchichten((liste) =>
      liste.map((s) =>
        s.id === schichtId
          ? {
              ...s,
              pausen: s.pausen.map((p) => {
                if (p.id !== pauseId) return p;
                const beginn = aenderung.beginn !== undefined ? parseUhrzeit(aenderung.beginn) ?? undefined : p.beginn;
                return { ...p, dauerMinuten: aenderung.dauerMinuten ?? p.dauerMinuten, beginn };
              }),
            }
          : s,
      ),
    );
  };

  // Live-validates the draft shifts against ArbZG rules before saving, so a clear legal violation
  // (schweregrad "fehler") requires explicit confirmation - checked against the in-progress edit,
  // not the stale results from before the dialog opened.
  const liveFehler = useMemo(() => {
    if (modus !== 'Schicht') return [];
    const kontext = { mitarbeiterId, datum };
    const nettoMinuten = schichten.reduce((summe, s) => summe + schichtNettoMinuten(s), 0);
    return [
      ...schichten.flatMap((s) => validiereSchichtdauer(s, kontext)),
      ...validierePausen(schichten, kontext),
      ...validiereTagesarbeitszeit(nettoMinuten, kontext),
    ].filter((e) => e.schweregrad === 'fehler');
  }, [modus, schichten, mitarbeiterId, datum]);

  const tatsaechlichSpeichern = () => {
    if (modus === 'Frei') {
      if (istEinzeltagigeAbwesenheit) onAbwesenheitLoeschen();
      onSpeichern({ typ: 'Frei' });
    } else if (modus === 'Schicht') {
      if (istEinzeltagigeAbwesenheit) onAbwesenheitLoeschen();
      onSpeichern({ typ: 'Schicht', schichten });
    } else {
      onAbwesenheitSpeichern(modus, modus === 'Sonstige' ? bezeichnung || 'Sonstige Abwesenheit' : undefined);
    }
    onClose();
  };

  const speichern = () => {
    if (liveFehler.length > 0) {
      setZeigeBestaetigung(true);
      return;
    }
    tatsaechlichSpeichern();
  };

  if (istMehrtaegigeAbwesenheit && abwesenheit) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {mitarbeiterName} · {tag}
          <Typography variant="body2" color="text.secondary">
            {datum}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info">
            {mitarbeiterName} ist an diesem Tag im Rahmen eines mehrtägigen Eintrags ({abwesenheit.art},{' '}
            {abwesenheit.von} bis {abwesenheit.bis}) abwesend. Bitte bearbeite oder lösche diesen Eintrag über den
            Tab „Abwesenheiten“.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Schließen</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {mitarbeiterName} · {tag}
        <Typography variant="body2" color="text.secondary">
          {datum}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <ToggleButtonGroup
          exclusive
          value={modus}
          onChange={(_, wert) => wert && setModus(wert)}
          size="small"
          sx={{ mb: 2, display: 'flex', '& .MuiToggleButton-root': { flex: 1 } }}
        >
          <ToggleButton value="Frei">Frei</ToggleButton>
          <ToggleButton value="Schicht">Arbeitszeit</ToggleButton>
          <ToggleButton value="Urlaub">Urlaub</ToggleButton>
          <ToggleButton value="Krankheit">Krankheit</ToggleButton>
          <ToggleButton value="Sonstige">Sonstige</ToggleButton>
        </ToggleButtonGroup>

        {modus === 'Frei' && (
          <Typography variant="body2" color="text.secondary">
            {mitarbeiterName} ist an diesem Tag nicht eingeplant und hat keinen Eintrag (weder Arbeitszeit noch
            Abwesenheit).
          </Typography>
        )}

        {modus === 'Urlaub' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Trägt für {mitarbeiterName} am {datum} einen ganztägigen Urlaubstag ein. Halbtags-Urlaub oder
            mehrtägige Zeiträume lassen sich im Tab „Abwesenheiten“ erfassen.
          </Alert>
        )}

        {modus === 'Krankheit' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Trägt für {mitarbeiterName} am {datum} einen Krankheitstag ein. Es werden bewusst keine Diagnose- oder
            Gesundheitsdetails erfasst.
          </Alert>
        )}

        {modus === 'Sonstige' && (
          <TextField
            label="Bezeichnung"
            placeholder="z. B. Fortbildung, Sonderurlaub"
            value={bezeichnung}
            onChange={(e) => setBezeichnung(e.target.value)}
            helperText={`Trägt eine ganztägige Abwesenheit für ${mitarbeiterName} am ${datum} ein.`}
            fullWidth
            sx={{ mb: 2 }}
          />
        )}

        {modus === 'Schicht' && (
          <Stack spacing={2}>
            {schichten.map((schicht, index) => {
              const nettoMinuten = schichtNettoMinuten(schicht);
              return (
                <Stack key={schicht.id} spacing={1.5} sx={{ p: 2, border: '1px solid #e0e0dc', borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">
                      Schicht {index + 1} · {minutenZuDezimalstunden(nettoMinuten).toLocaleString('de-DE')} Std. netto
                    </Typography>
                    {schichten.length > 1 && (
                      <IconButton size="small" onClick={() => schichtEntfernen(schicht.id)} aria-label="Schicht entfernen">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Beginn"
                      type="time"
                      value={schicht.beginn}
                      onChange={(e) => {
                        const wert = parseUhrzeit(e.target.value);
                        if (wert) schichtAendern(schicht.id, { beginn: wert });
                      }}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                    <TextField
                      label="Ende"
                      type="time"
                      value={schicht.ende}
                      onChange={(e) => {
                        const wert = parseUhrzeit(e.target.value);
                        if (wert) schichtAendern(schicht.id, { ende: wert });
                      }}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  </Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={schicht.endeFolgetag}
                        onChange={(e) => schichtAendern(schicht.id, { endeFolgetag: e.target.checked })}
                      />
                    }
                    label="Ende liegt am Folgetag (Nachtschicht)"
                  />

                  <Divider />
                  <Typography variant="body2" fontWeight={500}>
                    Pausen
                  </Typography>
                  {schicht.pausen.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Keine Pause eingetragen.
                    </Typography>
                  )}
                  {schicht.pausen.map((pause) => (
                    <Stack key={pause.id} direction="row" spacing={1.5} alignItems="center">
                      <TextField
                        label="Beginn (optional)"
                        type="time"
                        size="small"
                        value={pause.beginn ?? ''}
                        onChange={(e) => pauseAendern(schicht.id, pause.id, { beginn: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 170 }}
                      />
                      <TextField
                        label="Dauer (Min.)"
                        type="number"
                        size="small"
                        value={pause.dauerMinuten}
                        onChange={(e) => pauseAendern(schicht.id, pause.id, { dauerMinuten: Number(e.target.value) || 0 })}
                        sx={{ width: 140 }}
                      />
                      <IconButton size="small" onClick={() => pauseEntfernen(schicht.id, pause.id)} aria-label="Pause entfernen">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button size="small" startIcon={<AddIcon />} onClick={() => pauseHinzufuegen(schicht.id)} sx={{ alignSelf: 'flex-start' }}>
                    Pause hinzufügen
                  </Button>
                </Stack>
              );
            })}

            <Button size="small" startIcon={<AddIcon />} onClick={schichtHinzufuegen} sx={{ alignSelf: 'flex-start' }}>
              {schichten.length === 0 ? 'Schicht hinzufügen' : 'Weitere Schicht hinzufügen (Split-Shift)'}
            </Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button variant="contained" onClick={speichern}>
          Speichern
        </Button>
      </DialogActions>

      <BestaetigungsDialog
        open={zeigeBestaetigung}
        titel="Gesetzesverstoß trotzdem speichern?"
        text={`Diese Schicht verstößt gegen das Arbeitszeitgesetz: ${liveFehler.map((e) => e.meldung).join(' ')}`}
        bestaetigenText="Trotzdem speichern"
        gefaehrlich
        onBestaetigen={() => {
          setZeigeBestaetigung(false);
          tatsaechlichSpeichern();
        }}
        onAbbrechen={() => setZeigeBestaetigung(false)}
      />
    </Dialog>
  );
}
