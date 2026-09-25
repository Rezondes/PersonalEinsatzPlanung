import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShiftDraft } from '@domain/schedule/shiftDraft';
import { newShiftDraft, newBreakDraft } from '@domain/schedule/shiftDraft';
import type { FieldValidationProps } from '@ui/hooks/useFormValidation';
import { ShiftListEditor } from './ShiftListEditor';

/** Same convention as DayEditor.test.tsx: required fields carry MUI's asterisk in their label
 * text, so match once it's stripped; time inputs additionally have no ARIA role and jsdom ignores
 * user.type on them, so their values are read/set via fireEvent.change. */
const byLabel = (label: string) => (text: string) => text.replace('*', '').trim() === label;
const timeField = (label: string) => screen.getByLabelText(byLabel(label));
const allByLabel = (label: string) => screen.getAllByLabelText(byLabel(label));
const setTime = (label: string, value: string) => fireEvent.change(timeField(label), { target: { value } });

/** ShiftListEditor is fully controlled - this host mirrors what every real caller (DayEditor,
 * ShiftTemplateDialog) does: owns the drafts array itself and feeds onChange's result straight
 * back in, so a real user interaction (typing, clicking) produces real, observable DOM changes. */
/** jsdom has no matchMedia, so useBreakpoint reads it as a phone; this answers every query as a
 * desktop instead. */
function mockDesktop() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function Host({
  initialDrafts,
  onChangeSpy,
  fieldProps = () => ({ error: false }),
}: {
  initialDrafts: ShiftDraft[];
  onChangeSpy?: (drafts: ShiftDraft[]) => void;
  fieldProps?: (field: string) => FieldValidationProps;
}) {
  const [drafts, setDrafts] = useState(initialDrafts);
  return (
    <ShiftListEditor
      drafts={drafts}
      onChange={(next) => {
        onChangeSpy?.(next);
        setDrafts(next);
      }}
      fieldProps={fieldProps}
    />
  );
}

describe('ShiftListEditor', () => {
  it('shows only "Schicht hinzufügen" and no shift card when there are no drafts yet', () => {
    render(<Host initialDrafts={[]} />);

    expect(screen.getByRole('button', { name: 'Schicht hinzufügen' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Beginn')).not.toBeInTheDocument();
  });

  it('adds a 06:00-14:00 shift when "Schicht hinzufügen" is clicked on an empty list', async () => {
    const user = userEvent.setup();
    render(<Host initialDrafts={[]} />);

    await user.click(screen.getByRole('button', { name: 'Schicht hinzufügen' }));

    expect(timeField('Beginn')).toHaveValue('06:00');
    expect(timeField('Ende')).toHaveValue('14:00');
  });

  it('relabels the add button "Weitere Schicht hinzufügen (Split-Shift)" once a shift already exists, and adds a second card', async () => {
    const user = userEvent.setup();
    render(<Host initialDrafts={[newShiftDraft()]} />);

    expect(screen.getByRole('button', { name: 'Weitere Schicht hinzufügen (Split-Shift)' })).toBeInTheDocument();
    expect(allByLabel('Beginn')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Weitere Schicht hinzufügen (Split-Shift)' }));

    expect(allByLabel('Beginn')).toHaveLength(2);
  });

  it('updates a shift\'s Beginn/Ende as the user changes them', () => {
    render(<Host initialDrafts={[newShiftDraft('06:00', '14:00')]} />);

    setTime('Beginn', '08:00');
    setTime('Ende', '16:00');

    expect(timeField('Beginn')).toHaveValue('08:00');
    expect(timeField('Ende')).toHaveValue('16:00');
  });

  it('only shows a per-shift remove button once more than one shift exists, and removing one leaves the other untouched', async () => {
    const user = userEvent.setup();
    const first = newShiftDraft('06:00', '14:00');
    const second = newShiftDraft('16:00', '20:00');
    render(<Host initialDrafts={[first, second]} />);

    expect(screen.getByRole('button', { name: 'Schicht 1 entfernen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schicht 2 entfernen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Schicht 1 entfernen' }));

    expect(screen.queryByRole('button', { name: /entfernen/ })).not.toBeInTheDocument();
    expect(timeField('Beginn')).toHaveValue('16:00');
  });

  it('does not render a remove button for the only remaining shift', () => {
    render(<Host initialDrafts={[newShiftDraft()]} />);
    expect(screen.queryByRole('button', { name: /Schicht 1 entfernen/ })).not.toBeInTheDocument();
  });

  it('shows "Keine Pause eingetragen." until a break is added, then adds one with a 30-minute default via "Pause hinzufügen"', async () => {
    const user = userEvent.setup();
    render(<Host initialDrafts={[newShiftDraft()]} />);

    expect(screen.getByText('Keine Pause eingetragen.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pause hinzufügen' }));

    expect(screen.queryByText('Keine Pause eingetragen.')).not.toBeInTheDocument();
    expect(screen.getByLabelText(byLabel('Dauer (Min.)'))).toHaveValue('30');
  });

  it('removes only the targeted break when its own remove button is clicked', async () => {
    const user = userEvent.setup();
    const shift = { ...newShiftDraft(), breaks: [newBreakDraft(15), newBreakDraft(45)] };
    render(<Host initialDrafts={[shift]} />);

    expect(allByLabel('Dauer (Min.)').map((el) => (el as HTMLInputElement).value)).toEqual(['15', '45']);

    await user.click(screen.getByRole('button', { name: 'Pause 1 entfernen (Schicht 1)' }));

    expect(allByLabel('Dauer (Min.)').map((el) => (el as HTMLInputElement).value)).toEqual(['45']);
  });

  // Teil 8, Package 18: 170 + 140px fields plus the delete button (~368px) in ~295px on a phone.
  describe('pause row width', () => {
    const pauseRow = () => allByLabel('Dauer (Min.)')[0].closest('.MuiStack-root') as HTMLElement;

    afterEach(() => {
      // @ts-expect-error -- undo the stub, jsdom has no matchMedia of its own
      delete window.matchMedia;
    });

    it('wraps on a phone', () => {
      render(<Host initialDrafts={[{ ...newShiftDraft(), breaks: [newBreakDraft(30)] }]} />);

      expect(pauseRow()).toHaveStyle({ flexWrap: 'wrap' });
    });

    it('stays one row on a desktop', () => {
      mockDesktop();
      render(<Host initialDrafts={[{ ...newShiftDraft(), breaks: [newBreakDraft(30)] }]} />);

      expect(pauseRow()).not.toHaveStyle({ flexWrap: 'wrap' });
    });
  });

  // Teil 8, Package 16: every pause of a shift had the same name, "Pause entfernen (Schicht 1)".
  it('names each pause remove button by its own pause number', () => {
    const shift = { ...newShiftDraft(), breaks: [newBreakDraft(15), newBreakDraft(45)] };
    render(<Host initialDrafts={[shift]} />);

    expect(screen.getByRole('button', { name: 'Pause 1 entfernen (Schicht 1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause 2 entfernen (Schicht 1)' })).toBeInTheDocument();
  });

  it('shows the computed net hours for a complete shift, and a dash once it is missing its end time', () => {
    render(<Host initialDrafts={[newShiftDraft('06:00', '14:00')]} />);

    expect(screen.getByText(/8 Std\. netto/)).toBeInTheDocument();

    setTime('Ende', '');

    expect(screen.getByText(/– Std\. netto/)).toBeInTheDocument();
  });

  it('shows the shift-list field error message when fieldProps reports one for the list as a whole', () => {
    render(
      <Host
        initialDrafts={[]}
        fieldProps={(field) =>
          field === 'shifts' ? { error: true, helperText: 'Bitte mindestens eine Schicht anlegen.' } : { error: false }
        }
      />,
    );

    expect(screen.getByText('Bitte mindestens eine Schicht anlegen.')).toBeInTheDocument();
  });

  it('calls onChange with the updated drafts array on every edit', async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<Host initialDrafts={[]} onChangeSpy={onChangeSpy} />);

    await user.click(screen.getByRole('button', { name: 'Schicht hinzufügen' }));

    expect(onChangeSpy).toHaveBeenCalledTimes(1);
    expect(onChangeSpy.mock.calls[0][0]).toHaveLength(1);
  });
});
