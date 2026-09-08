import { useEffect, useState } from 'react';
import TextField from '@mui/material/TextField';
import type { TextFieldProps } from '@mui/material/TextField';

/** Formats for the input box, not for display: no thousands grouping, because a grouped "25.000"
 * contains a period that the input filter below would reject on the very next keystroke. */
function formatComma(value: number): string {
  return value.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 10 });
}

function parseCommaNumber(text: string): number | undefined {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '' || cleaned === '-') return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

type DecimalTextFieldProps = Omit<TextFieldProps, 'value' | 'onChange' | 'type'> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
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
export function DecimalTextField({ value, onChange, slotProps, ...rest }: DecimalTextFieldProps) {
  const [draft, setDraft] = useState(value != null ? formatComma(value) : '');

  useEffect(() => {
    if (parseCommaNumber(draft) !== value) {
      setDraft(value != null ? formatComma(value) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextField
      {...rest}
      type="text"
      // `inputMode` must reach the native <input>, not TextField's wrapper div, or mobile
      // browsers never show the decimal keyboard.
      slotProps={{ ...slotProps, htmlInput: { inputMode: 'decimal', ...slotProps?.htmlInput } }}
      value={draft}
      onChange={(e) => {
        const text = e.target.value;
        if (!/^-?[0-9]*,?[0-9]*$/.test(text)) return;
        setDraft(text);
        onChange(parseCommaNumber(text));
      }}
    />
  );
}
