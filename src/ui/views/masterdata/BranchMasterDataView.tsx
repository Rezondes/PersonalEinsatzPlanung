import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import type { TFunction } from 'i18next';
import type { Branch } from '@domain/branch/Branch';
import { services } from '@infrastructure/services';
import { useBranchList } from '@ui/hooks/useBranch';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useActivationToggle } from '@ui/hooks/useActivationToggle';
import { useTableSort } from '@ui/hooks/useTableSort';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { stickyCornerSx, stickyFirstColumnSx, stickyHeaderRowSx } from '@ui/components/stickyFirstColumn';
import { ResponsiveDataList } from '@ui/components/ResponsiveList/ResponsiveDataList';
import { RowActionSheet } from '@ui/components/ResponsiveList/RowActionSheet';
import type { RowAction } from '@ui/components/ResponsiveList/RowAction';
import { useLongPress } from '@ui/components/ResponsiveList/useLongPress';
import { BranchDialog } from './BranchDialog';
import { notify } from '@ui/app/store/notificationStore';
import { usePageActions } from '@ui/app/PageActionsContext';

const COLUMN_COUNT = 4;

type SortKey = 'name' | 'city' | 'status';

/** German collation, like EmployeeMasterDataView's own compareText - a plain "a < b" would sort
 * umlauts wrongly. */
function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'de');
}

/** Every comparator falls back to the name order, matching EmployeeMasterDataView's own
 * COMPARATORS - equal values keep a stable, familiar order instead of whatever the previous sort
 * left behind. */
const COMPARATORS: Record<SortKey, (a: Branch, b: Branch) => number> = {
  name: (a, b) => compareText(a.name, b.name),
  city: (a, b) => compareText(a.address.city, b.address.city) || compareText(a.name, b.name),
  status: (a, b) => Number(a.active) - Number(b.active) || compareText(a.name, b.name),
};

function getRowActions(
  branch: Branch,
  onEdit: (b: Branch) => void,
  onToggle: (b: Branch) => void,
  t: TFunction<'masterdata'>,
  tCommon: TFunction,
): RowAction[] {
  return [
    { key: 'edit', label: tCommon('edit'), icon: EditOutlinedIcon, onSelect: () => onEdit(branch) },
    {
      key: 'toggle',
      label: branch.active ? tCommon('deactivate') : tCommon('activate'),
      hint: branch.active ? t('branch.deactivateHint') : undefined,
      icon: branch.active ? ToggleOnOutlinedIcon : ToggleOffOutlinedIcon,
      dangerous: branch.active,
      onSelect: () => onToggle(branch),
    },
  ];
}

/** Mobile card: the ButtonBase portion taps/keyboard-activates to edit, long-press OR the visible
 * kebab icon opens the action sheet - same pattern as EmployeeMasterDataView's card. The kebab is a
 * sibling of the ButtonBase, not nested inside it: a <button> inside another <button> is invalid
 * HTML and React warns (validateDOMNesting), matching the reasoning already documented on
 * ScheduleToolbar's assign banner. Without it, deactivating/reactivating a card was reachable only
 * via a timed long-press gesture, which has no keyboard equivalent. */
function BranchCard({ branch, onTap, onLongPress }: { branch: Branch; onTap: () => void; onLongPress: () => void }) {
  const { t } = useTranslation();
  const handlers = useLongPress({ onTap, onLongPress });
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        width: '100%',
        minHeight: 76,
        pr: 0.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        opacity: branch.active ? 1 : 0.55,
      }}
    >
      <ButtonBase
        {...handlers}
        sx={{
          display: 'flex',
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          gap: 1.5,
          minHeight: 76,
          p: '10px 4px 10px 12px',
          textAlign: 'left',
          borderRadius: 2,
        }}
      >
        <Avatar
          src={branch.logoBase64 ?? undefined}
          variant="rounded"
          sx={(theme) => ({ bgcolor: theme.palette.accentSurface.subtle, flexShrink: 0 })}
        >
          <StoreOutlinedIcon sx={(theme) => ({ color: theme.palette.primary.main })} fontSize="small" />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} noWrap>
            {branch.branchNumber} {branch.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {branch.address.city || '-'} · {branch.federalState}
          </Typography>
        </Box>
        <Chip size="small" label={branch.active ? t('active') : t('inactive')} color={branch.active ? 'success' : 'default'} sx={{ flexShrink: 0 }} />
        <ChevronRightIcon sx={{ color: 'rgba(0,0,0,0.38)', flexShrink: 0 }} />
      </ButtonBase>
      <IconButton onClick={onLongPress} aria-label={t('otherActionsFor', { name: branch.name })} sx={{ flexShrink: 0 }}>
        <MoreVertIcon />
      </IconButton>
    </Box>
  );
}

export function BranchMasterDataView() {
  const { t } = useTranslation('masterdata');
  const { t: tCommon } = useTranslation();
  const layout = useBreakpoint();
  const { branches, loading, reload } = useBranchList();
  // null = closed; { branch: null } = "Neue Filiale"; { branch } = edit. Mounted only while open.
  const [dialog, setDialog] = useState<{ branch: Branch | null } | null>(null);
  const {
    target: statusTarget,
    request: requestStatusChange,
    cancel: cancelStatusChange,
    confirm: changeStatus,
    busy: statusChangeBusy,
  } = useActivationToggle(services.branch, reload, t('branch.entityLabel'));
  const [sheetBranch, setSheetBranch] = useState<Branch | null>(null);
  const [search, setSearch] = useState('');
  const { headProps, sortRows } = useTableSort<SortKey>('name');

  usePageActions({
    fullBleedPage: true,
    fab: { label: t('branch.newButton'), icon: AddIcon, onClick: () => setDialog({ branch: null }) },
  });

  const visibleBranches = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = branches.filter((b) => {
      if (!term) return true;
      return `${b.name} ${b.branchNumber} ${b.address.city}`.toLowerCase().includes(term);
    });
    return sortRows(filtered, COMPARATORS);
  }, [branches, search, sortRows]);

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
        {/* Hidden on mobile: MobileFab (registered above via usePageActions) is the primary
            action there, same pattern as EmployeeMasterDataView/AbsencesView. */}
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setDialog({ branch: null })}
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          {t('branch.newButton')}
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder={t('branch.searchPlaceholder')}
          // A top-level aria-label prop lands on TextField's outer wrapper, not the native input
          // getByLabelText/screen readers need - inputProps forwards down to that inner element
          // (same fix as AppHeader.tsx's Filiale Select, see its comment there).
          inputProps={{ 'aria-label': t('branch.searchAriaLabel') }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ResponsiveDataList
          rows={visibleBranches}
          getKey={(b) => b.id}
          emptyMessage={branches.length === 0 ? t('branch.emptyNone') : t('branch.emptyNoMatch')}
          renderCard={(b) => (
            <BranchCard branch={b} onTap={() => setDialog({ branch: b })} onLongPress={() => setSheetBranch(b)} />
          )}
        >
          <TableContainer component={Paper} sx={{ height: '100%' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={stickyCornerSx()}>
                    <TableSortLabel {...headProps('name')}>{t('branch.entityLabel')}</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('city')}>{t('branch.columnCity')}</TableSortLabel>
                  </TableCell>
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('status')}>{t('branch.columnStatus')}</TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sx={stickyHeaderRowSx()}>
                    {tCommon('columnActions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!loading && branches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT}>
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        {t('branch.emptyNone')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && branches.length > 0 && visibleBranches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT}>
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        {t('branch.emptyNoMatch')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {visibleBranches.map((b) => {
                  return (
                    <TableRow
                      key={b.id}
                      hover
                      onClick={() => setDialog({ branch: b })}
                      sx={{ opacity: b.active ? 1 : 0.55, cursor: 'pointer' }}
                    >
                      <TableCell sx={stickyFirstColumnSx}>
                        {b.name}
                        <Typography variant="caption" color="text.secondary" display="block">
                          {b.branchNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>{b.address.city || '-'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={b.active ? tCommon('active') : tCommon('inactive')} color={b.active ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setSheetBranch(b);
                          }}
                          aria-label={tCommon('otherActionsFor', { name: b.name })}
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
        <BranchDialog
          branch={dialog.branch}
          onClose={() => setDialog(null)}
          onSaved={reload}
          onError={notify.report}
          secondaryActions={
            dialog.branch
              ? getRowActions(dialog.branch, (b) => setDialog({ branch: b }), (b) => requestStatusChange(b), t, tCommon).filter(
                  (a) => a.key !== 'edit',
                )
              : undefined
          }
        />
      )}

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.active ? t('branch.deactivateTitle') : t('branch.activateTitle')}
        text={t(statusTarget?.active ? 'branch.deactivateText' : 'branch.activateText', { name: statusTarget?.name ?? '' })}
        confirmText={statusTarget?.active ? tCommon('deactivate') : tCommon('activate')}
        dangerous={!!statusTarget?.active}
        busy={statusChangeBusy}
        onConfirm={changeStatus}
        onCancel={cancelStatusChange}
      />

      <RowActionSheet
        open={!!sheetBranch}
        onClose={() => setSheetBranch(null)}
        title={sheetBranch ? `${sheetBranch.branchNumber} ${sheetBranch.name}` : ''}
        subtitle={sheetBranch ? `${sheetBranch.address.city || '-'} · ${sheetBranch.federalState}` : undefined}
        actions={sheetBranch ? getRowActions(sheetBranch, (b) => setDialog({ branch: b }), (b) => requestStatusChange(b), t, tCommon) : []}
      />
    </Box>
  );
}
