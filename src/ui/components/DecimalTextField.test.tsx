import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecimalTextField } from './DecimalTextField';

/** Mirrors how every call site uses the field: the parent stores the parsed number and passes
 * it straight back in as `value`, so each keystroke round-trips through a controlled re-render. */
function ControlledHarness({
  initial,
  onChange,
}: {
  initial?: number;
  onChange?: (value: number | undefined) => void;
}) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <>
      <DecimalTextField
        label="Wochenstunden"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <button type="button" onClick={() => setValue(40)}>
        Zurücksetzen
      </button>
      <output>{value === undefined ? 'leer' : String(value)}</output>
    </>
  );
}

function field() {
  return screen.getByRole('textbox', { name: 'Wochenstunden' });
}

describe('DecimalTextField', () => {
  describe('rendering', () => {
    it('shows a stored value with a comma as decimal separator', () => {
      render(<DecimalTextField label="Wochenstunden" value={38.5} onChange={() => {}} />);
      expect(field()).toHaveValue('38,5');
    });

    it('shows an empty field when the value is undefined', () => {
      render(<DecimalTextField label="Wochenstunden" value={undefined} onChange={() => {}} />);
      expect(field()).toHaveValue('');
    });

    it('shows a negative value with a comma', () => {
      render(<DecimalTextField label="Wochenstunden" value={-0.5} onChange={() => {}} />);
      expect(field()).toHaveValue('-0,5');
    });

    it('renders values of 1000 or more without a thousands separator', () => {
      render(<DecimalTextField label="Wochenstunden" value={25000} onChange={() => {}} />);
      expect(field()).toHaveValue('25000');
    });

    it('keeps native input attributes supplied by the caller alongside the decimal keyboard', () => {
      render(
        <DecimalTextField
          label="Wochenstunden"
          value={undefined}
          onChange={() => {}}
          slotProps={{ htmlInput: { maxLength: 6 } }}
        />,
      );
      expect(field()).toHaveAttribute('inputmode', 'decimal');
      expect(field()).toHaveAttribute('maxlength', '6');
    });

    it('is labelled and uses the decimal keyboard on touch devices', () => {
      render(<DecimalTextField label="Wochenstunden" value={undefined} onChange={() => {}} />);
      expect(field()).toHaveAttribute('inputmode', 'decimal');
      expect(field()).toHaveAttribute('type', 'text');
    });
  });

  describe('typing', () => {
    it('reports the parsed number for comma input', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledHarness onChange={onChange} />);

      await user.type(field(), '38,5');

      expect(field()).toHaveValue('38,5');
      expect(onChange).toHaveBeenLastCalledWith(38.5);
      expect(screen.getByRole('status')).toHaveTextContent('38.5');
    });

    it('keeps a trailing comma visible while the parent echoes the parsed integer', async () => {
      const user = userEvent.setup();
      render(<ControlledHarness />);

      await user.type(field(), '38,');

      expect(field()).toHaveValue('38,');
      expect(screen.getByRole('status')).toHaveTextContent('38');
    });

    it('keeps a lone minus sign while a negative number is being typed', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledHarness onChange={onChange} />);

      await user.type(field(), '-');
      expect(field()).toHaveValue('-');
      expect(onChange).toHaveBeenLastCalledWith(undefined);

      await user.type(field(), '0,5');
      expect(field()).toHaveValue('-0,5');
      expect(onChange).toHaveBeenLastCalledWith(-0.5);
    });

    it('lets the user keep typing into a value of 1000 or more', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledHarness initial={25000} onChange={onChange} />);

      await user.type(field(), '0');

      expect(field()).toHaveValue('250000');
      expect(onChange).toHaveBeenLastCalledWith(250000);
    });

    it('reports undefined when the field is cleared', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledHarness initial={38.5} onChange={onChange} />);

      await user.clear(field());

      expect(field()).toHaveValue('');
      expect(onChange).toHaveBeenLastCalledWith(undefined);
      expect(screen.getByRole('status')).toHaveTextContent('leer');
    });
  });

  describe('input filtering', () => {
    it('ignores a period so the German comma convention is enforced', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledHarness onChange={onChange} />);

      await user.type(field(), '38.');

      expect(field()).toHaveValue('38');
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(38);
    });

    it('ignores letters', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledHarness onChange={onChange} />);

      await user.type(field(), 'ab');

      expect(field()).toHaveValue('');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores a second comma', async () => {
      const user = userEvent.setup();
      render(<ControlledHarness />);

      await user.type(field(), '1,5,');

      expect(field()).toHaveValue('1,5');
    });

    it('reports undefined for a lone comma instead of NaN', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledHarness onChange={onChange} />);

      await user.type(field(), ',');

      expect(field()).toHaveValue(',');
      expect(onChange).toHaveBeenLastCalledWith(undefined);
    });

    it('ignores a minus sign that is not at the start', async () => {
      const user = userEvent.setup();
      render(<ControlledHarness />);

      await user.type(field(), '1-');

      expect(field()).toHaveValue('1');
    });
  });

  describe('external value changes', () => {
    it('re-syncs the draft when the parent sets a different value', async () => {
      const user = userEvent.setup();
      render(<ControlledHarness />);

      await user.type(field(), '12');
      await user.click(screen.getByRole('button', { name: 'Zurücksetzen' }));

      expect(field()).toHaveValue('40');
    });

    it('re-syncs to empty when the parent clears the value', () => {
      const { rerender } = render(
        <DecimalTextField label="Wochenstunden" value={38.5} onChange={() => {}} />,
      );
      rerender(<DecimalTextField label="Wochenstunden" value={undefined} onChange={() => {}} />);

      expect(field()).toHaveValue('');
    });
  });
});
