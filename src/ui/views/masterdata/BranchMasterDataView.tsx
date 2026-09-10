import { useState } from 'react';
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
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Branch } from '@domain/branch/Branch';
import { services } from '@infrastructure/services';
import { useBranchList } from '@ui/hooks/useBranch';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { stickyFirstColumnSx } from '@ui/components/stickyFirstColumn';
import { ResponsiveDataList } from '@ui/components/ResponsiveList/ResponsiveDataList';
import { RowActionSheet } from '@ui/components/ResponsiveList/RowActionSheet';
import type { RowAction } from '@ui/components/ResponsiveList/RowAction';
import { useLongPress } from '@ui/components/ResponsiveList/useLongPress';
import { BranchDialog } from './BranchDialog';
import { notify } from '@ui/app/store/notificationStore';
import { usePageActions } from '@ui/app/PageActionsContext';

const COLUMN_COUNT = 7;
const COLUMN_COUNT_TABLET = 4;

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

/** Mobile card: whole card taps to edit, long-press opens the action sheet - same pattern as
 * EmployeeMasterDataView's card. */
function BranchCard({ branch, onTap, onLongPress }: { branch: Branch; onTap: () => void; onLongPress: () => void }) {
  const handlers = useLongPress({ onTap, onLongPress });
  return (
    <ButtonBase
      {...handlers}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        minHeight: 76,
        p: '10px 12px 10px 12px',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        textAlign: 'left',
        opacity: branch.active ? 1 : 0.55,
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
  );
}

export function BranchMasterDataView() {
  const layout = useBreakpoint();
  const { branches, loading, reload } = useBranchList();
  // null = closed; { branch: null } = "Neue Filiale"; { branch } = edit. Mounted only while open.
  const [dialog, setDialog] = useState<{ branch: Branch | null } | null>(null);
  const [statusTarget, setStatusTarget] = useState<Branch | null>(null);
  const [sheetBranch, setSheetBranch] = useState<Branch | null>(null);

  usePageActions({
    fullBleedPage: true,
    fab: { label: 'Neue Filiale', icon: AddIcon, onClick: () => setDialog({ branch: null }) },
  });

  const changeStatus = async () => {
    if (!statusTarget) return;
    try {
      await services.branch.changeActiveStatus(statusTarget, !statusTarget.active);
      await reload();
    } catch (e) {
      notify.report(e, 'Status konnte nicht geändert werden');
    } finally {
      setStatusTarget(null);
    }
  };

  const columnCount = layout === 'laptop' ? COLUMN_COUNT : COLUMN_COUNT_TABLET;

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

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ResponsiveDataList
          rows={branches}
          getKey={(b) => b.id}
          emptyMessage="Noch keine Filiale angelegt."
          renderCard={(b) => (
            <BranchCard branch={b} onTap={() => setDialog({ branch: b })} onLongPress={() => setSheetBranch(b)} />
          )}
        >
          <TableContainer component={Paper} sx={{ height: '100%' }}>
            <Table>
              <TableHead>
                <TableRow>
                  {layout === 'laptop' && <TableCell>Logo</TableCell>}
                  <TableCell sx={stickyFirstColumnSx}>Filiale</TableCell>
                  {layout === 'laptop' && <TableCell>Nr.</TableCell>}
                  <TableCell>Ort</TableCell>
                  {layout === 'laptop' && <TableCell>Bundesland</TableCell>}
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Aktionen</TableCell>
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
                {branches.map((b) => {
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
                              onClick={() => setStatusTarget(b)}
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
              ? getRowActions(dialog.branch, (b) => setDialog({ branch: b }), (b) => setStatusTarget(b)).filter((a) => a.key !== 'edit')
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
        onConfirm={changeStatus}
        onCancel={() => setStatusTarget(null)}
      />

      <RowActionSheet
        open={!!sheetBranch}
        onClose={() => setSheetBranch(null)}
        title={sheetBranch ? `${sheetBranch.branchNumber} ${sheetBranch.name}` : ''}
        subtitle={sheetBranch ? `${sheetBranch.address.city || '-'} · ${sheetBranch.federalState}` : undefined}
        actions={sheetBranch ? getRowActions(sheetBranch, (b) => setDialog({ branch: b }), (b) => setStatusTarget(b)) : []}
      />
    </Box>
  );
}
