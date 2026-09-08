import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import type { FieldError } from '@domain/validation/FieldError';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';
import { useFormValidation } from './useFormValidation';

type Field = 'a' | 'b' | 'choice';

function Harness() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [choice, setChoice] = useState('');
  const [result, setResult] = useState('');

  const validation = useFormValidation<Field>(() => {
    const errors: FieldError<Field>[] = [];
    if (!a) errors.push({ field: 'a', message: 'A fehlt.' });
    if (!b) errors.push({ field: 'b', message: 'B fehlt.' });
    if (!choice) errors.push({ field: 'choice', message: 'Auswahl fehlt.' });
    return errors;
  });

  return (
    <div ref={validation.containerRef}>
      <TextField label="A" value={a} onChange={(e) => setA(e.target.value)} {...validation.fieldProps('a')} />
      <TextField label="B" value={b} onChange={(e) => setB(e.target.value)} {...validation.fieldProps('b', 'Hinweis zu B')} />
      <TextField select label="Auswahl" value={choice} onChange={(e) => setChoice(e.target.value)} {...validation.fieldProps('choice')}>
        <MenuItem value="x">X</MenuItem>
      </TextField>
      <FormErrorNotice errors={validation.errors} />
      <button type="button" onClick={() => setResult(validation.submit() ? 'gültig' : 'ungültig')}>
        Speichern
      </button>
      <button type="button" onClick={validation.reset}>
        Zurücksetzen
      </button>
      <output>{result}</output>
    </div>
  );
}

const fieldA = () => screen.getByRole('textbox', { name: 'A' });
const fieldB = () => screen.getByRole('textbox', { name: 'B' });
const save = () => screen.getByRole('button', { name: 'Speichern' });

describe('useFormValidation', () => {
  it('shows no errors before the first save attempt, only default helper texts', () => {
    render(<Harness />);

    expect(screen.queryByText('A fehlt.')).not.toBeInTheDocument();
    expect(screen.getByText('Hinweis zu B')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fieldA()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('marks every invalid field on submit, focuses the first one and reports invalid', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(save());

    expect(screen.getByText('A fehlt.')).toBeInTheDocument();
    expect(screen.getByText('B fehlt.')).toBeInTheDocument();
    expect(screen.getByText('Auswahl fehlt.')).toBeInTheDocument();
    expect(screen.queryByText('Hinweis zu B')).not.toBeInTheDocument();
    expect(fieldA()).toHaveAttribute('aria-invalid', 'true');
    expect(fieldA()).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte die rot markierten Felder prüfen.');
    expect(screen.getByRole('status')).toHaveTextContent('ungültig');
  });

  it('clears an error live as soon as its field is corrected, keeping the others', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(save());
    await user.type(fieldA(), 'x');

    expect(screen.queryByText('A fehlt.')).not.toBeInTheDocument();
    expect(screen.getByText('B fehlt.')).toBeInTheDocument();
    expect(fieldA()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('focuses a select field when it is the first invalid one', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(fieldA(), 'x');
    await user.type(fieldB(), 'y');
    await user.click(save());

    expect(screen.getByText('Auswahl fehlt.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Auswahl' })).toHaveFocus();
  });

  it('reports valid and shows no notice once everything is filled in', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(fieldA(), 'x');
    await user.type(fieldB(), 'y');
    await user.click(screen.getByRole('combobox', { name: 'Auswahl' }));
    await user.click(screen.getByRole('option', { name: 'X' }));
    await user.click(save());

    expect(screen.getByRole('status')).toHaveTextContent('gültig');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides all errors again after reset', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(save());
    await user.click(screen.getByRole('button', { name: 'Zurücksetzen' }));

    expect(screen.queryByText('A fehlt.')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
