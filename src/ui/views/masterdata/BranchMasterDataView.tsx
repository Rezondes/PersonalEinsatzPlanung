import { useMemo, useState } from 'react';
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

const COLUMN_COUNT = 7;
const COLUMN_COUNT_TABLET = 4;

type SortKey = 'name' | 'branchNumber' | 'city' | 'federalState' | 'status';

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
  branchNumber: (a, b) => compareText(a.branchNumber, b.branchNumber) || compareText(a.name, b.name),
  city: (a, b) => compareText(a.address.city, b.address.city) || compareText(a.name, b.name),
  federalState: (a, b) => compareText(a.federalState, b.federalState) || compareText(a.name, b.name),
  status: (a, b) => Number(a.active) - Number(b.active) || compareText(a.name, b.name),
};

function getRowActions(branch: Branch, onEdit: (b: Branch) => void, onToggle: (b: Branch) => void): RowAction[] {
  return [
    { key: 'edit', label: 'Bearbeiten', icon: EditOutlinedIcon, onSelect: () => onEdit(branch) },
    {
      key: 'toggle',
      label: branch.active ? 'Deaktivieren' : 'Aktivieren',
      hint: branch.active ? 'Bleibt in Wochenplänen und Abwesenheiten sichtbar' : undefined,
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
        <Avatar src={branch.logoBase64 ?? undefined} variant="rounded" sx={{ bgcolor: '#eef3f1', flexShrink: 0 }}>
          <StoreOutlinedIcon sx={{ color: '#2f5d50' }} fontSize="small" />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} noWrap>
            {branch.branchNumber} {branch.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {branch.address.city || '-'} · {branch.federalState}
          </Typography>
        </Box>
        <Chip size="small" label={branch.active ? 'Aktiv' : 'Inaktiv'} color={branch.active ? 'success' : 'default'} sx={{ flexShrink: 0 }} />
        <ChevronRightIcon sx={{ color: 'rgba(0,0,0,0.38)', flexShrink: 0 }} />
      </ButtonBase>
      <IconButton onClick={onLongPress} aria-label={`Weitere Aktionen für ${branch.name}`} sx={{ flexShrink: 0 }}>
        <MoreVertIcon />
      </IconButton>
    </Box>
  );
}

export function BranchMasterDataView() {
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
  } = useActivationToggle(services.branch, reload, 'Filiale');
  const [sheetBranch, setSheetBranch] = useState<Branch | null>(null);
  const [search, setSearch] = useState('');
  const { headProps, sortRows } = useTableSort<SortKey>('name');

  usePageActions({
    fullBleedPage: true,
    fab: { label: 'Neue Filiale', icon: AddIcon, onClick: () => setDialog({ branch: null }) },
  });

  const columnCount = layout === 'laptop' ? COLUMN_COUNT : COLUMN_COUNT_TABLET;

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
          Neue Filiale
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Name, Nummer oder Ort"
          aria-label="Filiale suchen"
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
          emptyMessage={branches.length === 0 ? 'Noch keine Filiale angelegt.' : 'Keine Filiale passt zur Suche.'}
          renderCard={(b) => (
            <BranchCard branch={b} onTap={() => setDialog({ branch: b })} onLongPress={() => setSheetBranch(b)} />
          )}
        >
          <TableContainer component={Paper} sx={{ height: '100%' }}>
            <Table>
              <TableHead>
                <TableRow>
                  {layout === 'laptop' && <TableCell sx={stickyHeaderRowSx()}>Logo</TableCell>}
                  <TableCell sx={stickyCornerSx()}>
                    <TableSortLabel {...headProps('name')}>Filiale</TableSortLabel>
                  </TableCell>
                  {layout === 'laptop' && (
                    <TableCell sx={stickyHeaderRowSx()}>
                      <TableSortLabel {...headProps('branchNumber')}>Nr.</TableSortLabel>
                    </TableCell>
                  )}
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('city')}>Ort</TableSortLabel>
                  </TableCell>
                  {layout === 'laptop' && (
                    <TableCell sx={stickyHeaderRowSx()}>
                      <TableSortLabel {...headProps('federalState')}>Bundesland</TableSortLabel>
                    </TableCell>
                  )}
                  <TableCell sx={stickyHeaderRowSx()}>
                    <TableSortLabel {...headProps('status')}>Status</TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sx={stickyHeaderRowSx()}>
                    Aktionen
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!loading && branches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columnCount}>
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        Noch keine Filiale angelegt.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && branches.length > 0 && visibleBranches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columnCount}>
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        Keine Filiale passt zur Suche.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {visibleBranches.map((b) => {
                  const rowClickable = layout !== 'laptop';
                  return (
                    <TableRow
                      key={b.id}
                      hover
                      onClick={rowClickable ? () => setDialog({ branch: b }) : undefined}
                      sx={{ opacity: b.active ? 1 : 0.55, cursor: rowClickable ? 'pointer' : undefined }}
                    >
                      {layout === 'laptop' && (
                        <TableCell>
                          <Avatar src={b.logoBase64 ?? undefined} variant="rounded" sx={{ bgcolor: '#eef3f1' }}>
                            <StoreOutlinedIcon sx={{ color: '#2f5d50' }} fontSize="small" />
                          </Avatar>
                        </TableCell>
                      )}
                      <TableCell sx={stickyFirstColumnSx}>
                        {b.name}
                        {layout !== 'laptop' && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {b.branchNumber}
                          </Typography>
                        )}
                      </TableCell>
                      {layout === 'laptop' && <TableCell>{b.branchNumber}</TableCell>}
                      <TableCell>{b.address.city || '-'}</TableCell>
                      {layout === 'laptop' && <TableCell>{b.federalState}</TableCell>}
                      <TableCell>
                        <Chip size="small" label={b.active ? 'Aktiv' : 'Inaktiv'} color={b.active ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        {layout === 'laptop' ? (
                          <>
                            <IconButton size="small" onClick={() => setDialog({ branch: b })} aria-label={`${b.name} bearbeiten`}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => requestStatusChange(b)}
                              aria-label={b.active ? `${b.name} deaktivieren` : `${b.name} aktivieren`}
                            >
                              {b.active ? <ToggleOnOutlinedIcon fontSize="small" /> : <ToggleOffOutlinedIcon fontSize="small" />}
                            </IconButton>
                          </>
                        ) : (
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setSheetBranch(b);
                            }}
                            aria-label={`Weitere Aktionen für ${b.name}`}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        )}
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
              ? getRowActions(dialog.branch, (b) => setDialog({ branch: b }), (b) => requestStatusChange(b)).filter((a) => a.key !== 'edit')
              : undefined
          }
        />
      )}

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.active ? 'Filiale deaktivieren?' : 'Filiale aktivieren?'}
        text={
          statusTarget?.active
            ? `${statusTarget?.name} wird als inaktiv markiert und verschwindet aus der Filial-Auswahl. Mitarbeiter, Wochenpläne und Abwesenheiten bleiben vollständig erhalten und die Filiale kann jederzeit wieder aktiviert werden.`
            : `${statusTarget?.name} wird wieder als aktiv markiert und erscheint wieder in der Filial-Auswahl.`
        }
        confirmText={statusTarget?.active ? 'Deaktivieren' : 'Aktivieren'}
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
        actions={sheetBranch ? getRowActions(sheetBranch, (b) => setDialog({ branch: b }), (b) => requestStatusChange(b)) : []}
      />
    </Box>
  );
}
