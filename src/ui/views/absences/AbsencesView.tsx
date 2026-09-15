import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import AddIcon from '@mui/icons-material/Add';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { formatISODateGerman } from '@domain/shared/DateFormat';
import type { Absence, AbsenceType } from '@domain/absence/Absence';
import { absenceTypeLabel, absenceKindLabel } from '@domain/absence/Absence';
import type { Employee } from '@domain/employee/Employee';
import { compareByLastName, fullName } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useAbsences } from '@ui/hooks/useAbsences';
import { useTableSort } from '@ui/hooks/useTableSort';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { NoBranchSelectedAlert } from '@ui/components/NoBranchSelectedAlert';
import { stickyCornerSx, stickyFirstColumnSx, stickyHeaderRowSx } from '@ui/components/stickyFirstColumn';
import { ResponsiveDataList } from '@ui/components/ResponsiveList/ResponsiveDataList';
import { RowActionSheet } from '@ui/components/ResponsiveList/RowActionSheet';
import type { RowAction } from '@ui/components/ResponsiveList/RowAction';
import { useLongPress } from '@ui/components/ResponsiveList/useLongPress';
import { AbsenceDialog } from './AbsenceDialog';
import { CreateHolidaysDialog } from './components/CreateHolidaysDialog';
import { notify } from '@ui/app/store/notificationStore';
import { usePageActions } from '@ui/app/PageActionsContext';

type SortKey = 'employee' | 'type' | 'from' | 'to';
type TypeFilter = 'all' | AbsenceType;

const ALL = 'all';
const COLUMN_COUNT = 5;

function getAbsenceRowActions(
  absence: Absence,
  onEdit: (a: Absence) => void,
  onDelete: (a: Absence) => void,
  tCommon: TFunction,
): RowAction[] {
  return [
    { key: 'edit', label: tCommon('edit'), icon: EditOutlinedIcon, onSelect: () => onEdit(absence) },
    { key: 'delete', label: tCommon('delete'), icon: DeleteOutlineIcon, dangerous: true, onSelect: () => onDelete(absence) },
  ];
}

/** Mobile card. Tap = edit (matching the Mitarbeiter/Filialen "row = one target" convention),
 * long-press OR the visible kebab icon opens the action sheet with both Bearbeiten and Löschen -
 * same as EmployeeCard/BranchCard. Used to be a single always-visible delete IconButton with no
 * edit at all, back when absences were create-only. */
function AbsenceCard({
  absence,
  employeeName,
  onTap,
  onLongPress,
}: {
  absence: Absence;
  employeeName: string;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const { t } = useTranslation('absences');
  const handlers = useLongPress({ onTap, onLongPress });
  const halfDayText =
    absence.type === 'Vacation' && absence.halfDay && absence.from === absence.to
      ? absence.halfDay.atStart
        ? t('halfDayMorning')
        : absence.halfDay.atEnd
          ? t('halfDayAfternoon')
          : ''
      : '';
  const rangeText =
    absence.from === absence.to
      ? formatISODateGerman(absence.from)
      : `${formatISODateGerman(absence.from)} – ${formatISODateGerman(absence.to)}`;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        width: '100%',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: '4px 4px 4px 14px',
      }}
    >
      <ButtonBase
        {...handlers}
        sx={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'flex-start', py: '8px', textAlign: 'left', borderRadius: 2 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={500} noWrap>
              {employeeName}
            </Typography>
            <Chip size="small" label={absenceTypeLabel(absence) + halfDayText} />
          </Stack>
          <Typography variant="body2">{rangeText}</Typography>
          {absence.type === 'Other' && absence.hoursPerDay !== undefined && (
            <Typography variant="caption" color="text.secondary">
              {absence.hoursPerDay.toLocaleString('de-DE')} {t('hoursPerDaySuffix')}
            </Typography>
          )}
        </Box>
      </ButtonBase>
      <IconButton onClick={onLongPress} aria-label={t('otherActionsFor', { name: employeeName })}>
        <MoreVertIcon />
      </IconButton>
    </Box>
  );
}

export function AbsencesView() {
  const layout = useBreakpoint();
  const { t } = useTranslation('absences');
  const { t: tCommon } = useTranslation();
  const { branch } = useSelectedBranch();
  const { employeeList } = useEmployeeList(branch?.id ?? null);
  const activeEmployees = employeeList.filter((emp) => emp.active);
  const employeeIds = employeeList.map((emp) => emp.id);
  const { absences, loading: absencesLoading, reload } = useAbsences(employeeIds);
  // Mounted only while open, so the form starts fresh each time. null = closed; { absence: null } =
  // "Erfassen"; { absence } = edit.
  const [dialog, setDialog] = useState<{ absence: Absence | null } | null>(null);
  const [holidaysDialogOpen, setHolidaysDialogOpen] = useState(false);
  const [sheetAbsence, setSheetAbsence] = useState<Absence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(ALL);
  // Empty = "Alle" (every year), same meaning ALL had for the single-select this replaces.
  const [yearFilters, setYearFilters] = useState<string[]>([]);
  // Newest first, the order this view had before it became sortable.
  const sort = useTableSort<SortKey>('from', 'desc');

  // Registered whenever a branch is selected, regardless of whether there are active employees -
  // MobileFab now shows it disabled instead of omitting it entirely when there are none, so the
  // one touch affordance on this page does not silently vanish without explanation (N18).
  usePageActions({
    fab: branch
      ? {
          label: t('fabLabel'),
          icon: AddIcon,
          onClick: () => setDialog({ absence: null }),
          disabled: activeEmployees.length === 0,
        }
      : undefined,
    fullBleedPage: true,
  });

  const employeeById = useMemo(
    () => new Map(employeeList.map((emp) => [emp.id, emp])),
    [employeeList],
  );

  // Active employees, plus - only while editing - the absence's own owner even if they have since
  // become inactive: otherwise the Mitarbeiter field would have no matching option to show at all
  // for an absence booked before someone left, and saving could silently reassign it.
  const dialogEmployees = useMemo(() => {
    const editedOwner = dialog?.absence ? employeeById.get(dialog.absence.employeeId) : undefined;
    return editedOwner && !editedOwner.active ? [...activeEmployees, editedOwner] : activeEmployees;
  }, [dialog, activeEmployees, employeeById]);

  /** Every year any absence touches, so a range crossing New Year shows up under both. */
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const absence of absences) {
      const fromYear = Number(absence.from.slice(0, 4));
      const toYear = Number(absence.to.slice(0, 4));
      for (let y = fromYear; y <= toYear; y += 1) {
        years.add(String(y));
      }
    }
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [absences]);

  const { headProps, sortRows } = sort;
  const visibleAbsences = useMemo(() => {
    const comparators: Record<SortKey, (a: Absence, b: Absence) => number> = {
      employee: (a, b) => {
        const empA = employeeById.get(a.employeeId);
        const empB = employeeById.get(b.employeeId);
        if (!empA || !empB) return 0;
        return compareByLastName(empA, empB) || a.from.localeCompare(b.from);
      },
      type: (a, b) => absenceKindLabel(a.type).localeCompare(absenceKindLabel(b.type), 'de') || a.from.localeCompare(b.from),
      from: (a, b) => a.from.localeCompare(b.from),
      to: (a, b) => a.to.localeCompare(b.to),
    };

    const filtered = absences.filter((a) => {
      if (employeeFilter !== ALL && a.employeeId !== employeeFilter) return false;
      if (typeFilter !== ALL && a.type !== typeFilter) return false;
      // An absence belongs to a year when its range overlaps it, so a range crossing New Year is
      // found under both years - the same rule countVacationDaysInYear applies. Matching ANY of the
      // selected years (not all) is what makes this a year filter rather than a range filter - e.g.
      // 2025+2026 selected shows an absence touching either, not only one spanning both.
      if (
        yearFilters.length > 0 &&
        !yearFilters.some((y) => a.from.slice(0, 4) <= y && y <= a.to.slice(0, 4))
      ) {
        return false;
      }
      return true;
    });
    return sortRows(filtered, comparators);
  }, [absences, employeeById, employeeFilter, typeFilter, yearFilters, sortRows]);

  const deleteAbsence = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await services.absence.delete(deleteTarget.id);
      await reload();
      notify.success(t('deleteSuccess'));
    } catch (e) {
      notify.report(e, t('deleteError'));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (!branch) {
    return <NoBranchSelectedAlert />;
  }

  const employeeName = (employee: Employee | undefined) => (employee ? fullName(employee) : '–');

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        px: layout === 'mobile' ? 1.5 : 3,
        py: layout === 'mobile' ? 1.5 : 3,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        {/* Hidden on mobile: MobileFab (registered above via usePageActions, label "Erfassen"
            matching the mockup) is the primary action there. */}
        <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', sm: 'flex' } }}>
          {/* Tooltip on a disabled button never fires - MUI's own documented workaround is a plain
              span wrapper, which still receives the pointer/focus events the button itself no
              longer does (N18). */}
          <Tooltip title={activeEmployees.length === 0 ? t('noActiveEmployees') : ''}>
            <span>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setDialog({ absence: null })}
                disabled={activeEmployees.length === 0}
              >
                {t('createButton')}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={activeEmployees.length === 0 ? t('noActiveEmployees') : ''}>
            <span>
              <Button
                variant="outlined"
                startIcon={<EventAvailableOutlinedIcon />}
                onClick={() => setHolidaysDialogOpen(true)}
                disabled={activeEmployees.length === 0}
              >
                {t('createHolidaysLabel')}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            select
            size="small"
            label={t('employeeLabel')}
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            sx={{ width: 240 }}
          >
            <MenuItem value={ALL}>{t('filterAll')}</MenuItem>
            {employeeList.map((emp) => (
              <MenuItem key={emp.id} value={emp.id}>
                {fullName(emp)}
                {!emp.active && t('employeeInactiveSuffix')}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t('typeLabel')}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            sx={{ width: 180 }}
          >
            <MenuItem value={ALL}>{t('filterAll')}</MenuItem>
            <MenuItem value="Vacation">{tCommon('absenceKind.vacation')}</MenuItem>
            <MenuItem value="Illness">{tCommon('absenceKind.illness')}</MenuItem>
            <MenuItem value="PublicHoliday">{tCommon('absenceKind.publicHoliday')}</MenuItem>
            <MenuItem value="Other">{tCommon('absenceKind.other')}</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label={tCommon('yearLabel')}
            value={yearFilters}
            onChange={(e) => {
              const value = e.target.value as unknown as string | string[];
              setYearFilters(typeof value === 'string' ? (value ? value.split(',') : []) : value);
            }}
            SelectProps={{
              multiple: true,
              // Without displayEmpty, MUI shows a blank field (not renderValue's output) whenever
              // value is an empty array - it assumes "empty" means "show the floating label only",
              // which is wrong here since an empty selection is a meaningful state ("Alle").
              displayEmpty: true,
              renderValue: (selected) => ((selected as string[]).length === 0 ? t('filterAll') : (selected as string[]).join(', ')),
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          >
            {availableYears.map((y) => (
              <MenuItem key={y} value={y}>
                <Checkbox checked={yearFilters.includes(y)} size="small" />
                <ListItemText primary={y} />
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            {t('countSummary', {
              visible: visibleAbsences.length.toLocaleString('de-DE'),
              total: absences.length.toLocaleString('de-DE'),
            })}
          </Typography>
        </Stack>
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ResponsiveDataList
          rows={visibleAbsences}
          getKey={(a) => a.id}
          emptyMessage={
            absencesLoading
              ? ''
              : absences.length === 0
                ? t('emptyNone')
                : t('emptyNoMatch')
          }
          renderCard={(a) => (
            <AbsenceCard
              absence={a}
              employeeName={employeeName(employeeById.get(a.employeeId))}
              onTap={() => setDialog({ absence: a })}
              onLongPress={() => setSheetAbsence(a)}
            />
          )}
        >
          <TableContainer component={Paper} sx={{ height: '100%' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={stickyCornerSx()}>
                    <TableSortLabel {...headProps('employee')}>{t('employeeLabel')}</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('type')}>{t('typeLabel')}</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('from')}>{t('columnFrom')}</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('to')}>{t('columnTo')}</TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sx={stickyHeaderRowSx()}>
                    {tCommon('columnActions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!absencesLoading && absences.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT}>
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        {t('emptyNone')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!absencesLoading && absences.length > 0 && visibleAbsences.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT}>
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        {t('emptyNoMatch')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {visibleAbsences.map((a) => {
                  const employee = employeeById.get(a.employeeId);
                  // atStart = absent at the start of the day (morning), atEnd = absent at the end
                  // (afternoon) - must match the "Nur vormittags/nachmittags frei" checkbox labels below.
                  const halfDayText =
                    a.type === 'Vacation' && a.halfDay && a.from === a.to
                      ? a.halfDay.atStart
                        ? t('halfDayMorning')
                        : a.halfDay.atEnd
                          ? t('halfDayAfternoon')
                          : ''
                      : '';
                  return (
                    <TableRow
                      key={a.id}
                      hover
                      onClick={() => setDialog({ absence: a })}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={stickyFirstColumnSx}>{employeeName(employee)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={absenceTypeLabel(a) + halfDayText} />
                      </TableCell>
                      <TableCell>{formatISODateGerman(a.from)}</TableCell>
                      <TableCell>{formatISODateGerman(a.to)}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setSheetAbsence(a);
                          }}
                          aria-label={tCommon('otherActionsFor', { name: employeeName(employee) })}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </ResponsiveDataList>
      </Box>

      {dialog && (
        <AbsenceDialog
          employees={dialogEmployees}
          absences={absences}
          absence={dialog.absence}
          onClose={() => setDialog(null)}
          onSaved={reload}
          onError={notify.report}
        />
      )}

      {holidaysDialogOpen && (
        <CreateHolidaysDialog
          branch={branch}
          employees={activeEmployees}
          absences={absences}
          onClose={() => setHolidaysDialogOpen(false)}
          onApplied={({ created, skipped }) => {
            notify.success(t('holidaysCreated', { created, skipped }));
            reload();
          }}
          onError={notify.report}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('deleteConfirmTitle')}
        text={t('deleteConfirmText')}
        confirmText={tCommon('delete')}
        dangerous
        busy={deleting}
        onConfirm={deleteAbsence}
        onCancel={() => setDeleteTarget(null)}
      />

      <RowActionSheet
        open={!!sheetAbsence}
        onClose={() => setSheetAbsence(null)}
        title={sheetAbsence ? employeeName(employeeById.get(sheetAbsence.employeeId)) : ''}
        subtitle={sheetAbsence ? absenceTypeLabel(sheetAbsence) : undefined}
        actions={
          sheetAbsence
            ? getAbsenceRowActions(sheetAbsence, (a) => setDialog({ absence: a }), (a) => setDeleteTarget(a), tCommon)
            : []
        }
      />
    </Box>
  );
}
