import { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import type { BranchId } from '@domain/shared/ids';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import { validateShiftTemplate } from '@domain/schedule/shiftTemplateValidation';
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
import { ShiftListEditor } from './ShiftListEditor';

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
  const [name, setName] = useState(template?.name ?? '');
  const [drafts, setDrafts] = useState<ShiftDraft[]>(() => {
    if (template) {
      return template.shifts.map(shiftToDraft);
    }
    return initialDrafts && initialDrafts.length > 0 ? initialDrafts : [newShiftDraft()];
  });
  const [saving, setSaving] = useState(false);

  const validation = useFormValidation<string>(() => [
    ...validateShiftTemplate({ name, shiftCount: drafts.length }),
    // validateShiftDrafts reports an empty list on the same field, so that one message is dropped
    // here - the template rule above already covers it and two identical texts would be noise.
    ...validateShiftDrafts(drafts).filter((e) => e.field !== SHIFT_LIST_FIELD),
  ]);

  const save = async () => {
    if (!validation.submit()) return;
    const shifts = shiftDraftsToShifts(drafts);

    setSaving(true);
    try {
      if (template) {
        await services.shiftTemplate.update({ ...template, name: name.trim(), shifts });
      } else {
        await services.shiftTemplate.create({ branchId, name: name.trim(), shifts });
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
      onClose={onClose}
      title={template ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
      contentRef={validation.containerRef}
      actions={
        <>
          <FormErrorNotice errors={validation.errors} />
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            Speichern
          </Button>
        </>
      }
    >
      <RequiredLegend />
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Bezeichnung"
            required
            placeholder="z. B. Frühschicht"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            {...validation.fieldProps('name')}
          />
          <ShiftListEditor drafts={drafts} onChange={setDrafts} fieldProps={validation.fieldProps} />
        </Stack>
    </ResponsiveDialog>
  );
}
