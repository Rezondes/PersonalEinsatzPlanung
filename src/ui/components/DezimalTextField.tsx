import { useEffect, useState } from 'react';
import TextField from '@mui/material/TextField';
import type { TextFieldProps } from '@mui/material/TextField';

function formatiereKomma(zahl: number): string {
  return zahl.toLocaleString('de-DE');
}

function parseKommaZahl(text: string): number | undefined {
  const bereinigt = text.trim().replace(',', '.');
  if (bereinigt === '' || bereinigt === '-') return undefined;
  const zahl = Number(bereinigt);
  return Number.isFinite(zahl) ? zahl : undefined;
}

type DezimalTextFieldProps = Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & {
  value: number | undefined;
  onChange: (wert: number | undefined) => void;
};

/**
 * Number input that always uses a comma as the decimal separator (German convention), never a
 * period. A native `type="number"` input silently enforces the browser's locale-invariant period
 * format regardless of page locale - setting its value to a comma-formatted string like "-0,5"
 * simply fails, which is why a plain `TextField type="number"` cannot be used for German decimal
 * entry at all.
 *
 * Keeps a local "draft" string while the user is typing, and only re-syncs that draft from the
 * external `value` prop when it represents a genuinely different number than what's currently
 * typed - otherwise a controlled round-trip would immediately strip a trailing "," or a lone "-"
 * the moment the parent re-renders with the parsed number.
 */
export function DezimalTextField({ value, onChange, ...rest }: DezimalTextFieldProps) {
  const [entwurf, setEntwurf] = useState(value != null ? formatiereKomma(value) : '');

  useEffect(() => {
    if (parseKommaZahl(entwurf) !== value) {
      setEntwurf(value != null ? formatiereKomma(value) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextField
      {...rest}
      type="text"
      inputMode="decimal"
      value={entwurf}
      onChange={(e) => {
        const text = e.target.value;
        if (!/^-?[0-9]*,?[0-9]*$/.test(text)) return;
        setEntwurf(text);
        onChange(parseKommaZahl(text));
      }}
    />
  );
}
