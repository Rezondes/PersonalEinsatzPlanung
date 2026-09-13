import { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import type { BranchId } from '@domain/shared/ids';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { validateShiftTemplate } from '@domain/schedule/shiftTemplateValidation';
import type { ShiftTemplateDraft } from '@domain/schedule/shiftTemplateValidation';
import type { ShiftDraft } from '@domain/schedule/shiftDraft';
import {
  SHIFT_LIST_FIELD,
  newShiftDraft,
  shiftDraftsToShifts,
  shiftToDraft,
  validateShiftDrafts,
} from '@domain/schedule/shiftDraft';
import { services } from '@infrastructure/services';
import { useFormValidation } from '@ui/hooks/useFormValidation';
import { RequiredLegend } from '@ui/components/RequiredLegend';
import { FormErrorNotice } from '@ui/components/FormErrorNotice';
import { ResponsiveDialog } from '@ui/components/ResponsiveDialog';
import { DecimalTextField } from '@ui/components/DecimalTextField';
import { ShiftListEditor } from './ShiftListEditor';

type TemplateKind = ShiftTemplateDraft['kind'];

interface ShiftTemplateDialogProps {
  branchId: BranchId;
  /** null creates a new template, otherwise the given one is edited. */
  template: ShiftTemplate | null;
  /** Prefilled shifts when the template is being created from an existing day
   * ("Als Vorlage speichern"). Ignored while editing. */
  initialDrafts?: ShiftDraft[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (e: unknown, context?: string) => void;
}

/** Create/edit dialog for a reusable shift template. Mounted only while open (the parent renders it
 * conditionally), so form state and the "already tried to save" flag start fresh every time.
 * Field rules come from validateShiftTemplate/validateShiftDrafts in the domain. */
export function ShiftTemplateDialog({
  branchId,
  template,
  initialDrafts,
  onClose,
  onSaved,
  onError,
}: ShiftTemplateDialogProps) {
  const [kind, setKind] = useState<TemplateKind>(template?.kind ?? 'Shift');
  const [name, setName] = useState(template?.name ?? '');
  const [drafts, setDrafts] = useState<ShiftDraft[]>(() => {
    if (template?.kind === 'Shift') {
      return template.shifts.map(shiftToDraft);
    }
    return initialDrafts && initialDrafts.length > 0 ? initialDrafts : [newShiftDraft()];
  });
  const [hoursPerDay, setHoursPerDay] = useState<number | undefined>(
    template?.kind === 'Other' ? template.hoursPerDay : undefined,
  );
  const [saving, setSaving] = useState(false);

  // Other-kind templates use the single "Bezeichnung" field for both the toolbar tile's own name
  // AND the absence's label applied to a day - asking for the same text twice would be pointless
  // friction, unlike the Shift kind where the name is toolbar-only organization and never appears
  // on the day itself (the shift times do).
  const validation = useFormValidation<string>(() =>
    kind === 'Shift'
      ? [
          ...validateShiftTemplate({ kind: 'Shift', name, shiftCount: drafts.length }),
          // validateShiftDrafts reports an empty list on the same field, so that one message is
          // dropped here - the template rule above already covers it and two identical texts would
          // be noise.
          ...validateShiftDrafts(drafts).filter((e) => e.field !== SHIFT_LIST_FIELD),
        ]
      : // The 'label' field error is always identical to the 'name' one here (same value) - dropped
        // the same way the Shift-kind branch above drops validateShiftDrafts' duplicate message.
        validateShiftTemplate({ kind: 'Other', name, label: name, hoursPerDay }).filter((e) => e.field !== 'label'),
  );

  const save = async () => {
    if (!validation.submit()) return;
    const trimmedName = name.trim();

    setSaving(true);
    try {
      if (kind === 'Shift') {
        const shifts = shiftDraftsToShifts(drafts);
        // Built explicitly rather than {...template, ...} when template exists: template may
        // currently be the OTHER kind (switching kind while editing), and spreading it would leave
        // a stale label/hoursPerDay field on the persisted object even though TypeScript no longer
        // names it once `kind` is overridden.
        if (template) {
          await services.shiftTemplate.update({
            id: template.id,
            branchId: template.branchId,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            name: trimmedName,
            kind: 'Shift',
            shifts,
          });
        } else {
          await services.shiftTemplate.create({ branchId, name: trimmedName, kind: 'Shift', shifts });
        }
      } else {
        if (template) {
          await services.shiftTemplate.update({
            id: template.id,
            branchId: template.branchId,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            name: trimmedName,
            kind: 'Other',
            label: trimmedName,
            hoursPerDay,
          });
        } else {
          await services.shiftTemplate.create({ branchId, name: trimmedName, kind: 'Other', label: trimmedName, hoursPerDay });
        }
      }
      onClose();
      await onSaved();
    } catch (e) {
      onError(e, 'Vorlage konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onClose={saving ? undefined : onClose}
      title={template ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
      contentRef={validation.containerRef}
      actions={
        <>
          <FormErrorNotice errors={validation.errors} />
          <Button onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Speichern
          </Button>
        </>
      }
    >
      <RequiredLegend />
        <Stack spacing={2} sx={{ mt: 1 }}>
          <ToggleButtonGroup
            value={kind}
            exclusive
            onChange={(_e, value: TemplateKind | null) => value && setKind(value)}
            aria-label="Art der Vorlage"
            size="small"
          >
            <ToggleButton value="Shift">Arbeitszeit</ToggleButton>
            <ToggleButton value="Other">Sonstiges</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label="Bezeichnung"
            required
            placeholder="z. B. Frühschicht"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            {...validation.fieldProps('name')}
          />
          {kind === 'Shift' ? (
            <ShiftListEditor drafts={drafts} onChange={setDrafts} fieldProps={validation.fieldProps} />
          ) : (
            <DecimalTextField
              label="Stunden (optional)"
              value={hoursPerDay}
              onChange={setHoursPerDay}
              sx={{ width: 200 }}
              helperText="Zählen für den Mitarbeiter, an dem die Vorlage angewendet wird."
              {...validation.fieldProps('hoursPerDay')}
            />
          )}
        </Stack>
    </ResponsiveDialog>
  );
}
