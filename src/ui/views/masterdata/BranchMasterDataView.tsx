import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
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
import type { Branch } from '@domain/branch/Branch';
import { services } from '@infrastructure/services';
import { useBranchList } from '@ui/hooks/useBranch';
import { useErrorSnackbar } from '@ui/hooks/useErrorSnackbar';
import { ErrorSnackbar } from '@ui/components/ErrorSnackbar';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { BranchDialog } from './BranchDialog';

export function BranchMasterDataView() {
  const { branches, loading, reload } = useBranchList();
  // null = closed; { branch: null } = "Neue Filiale"; { branch } = edit. Mounted only while open.
  const [dialog, setDialog] = useState<{ branch: Branch | null } | null>(null);
  const [statusTarget, setStatusTarget] = useState<Branch | null>(null);
  const { error, report, reset } = useErrorSnackbar();

  const changeStatus = async () => {
    if (!statusTarget) return;
    try {
      await services.branch.changeActiveStatus(statusTarget, !statusTarget.active);
      await reload();
    } catch (e) {
      report(e, 'Status konnte nicht geändert werden');
    } finally {
      setStatusTarget(null);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Filialen
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialog({ branch: null })}>
          Neue Filiale
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Logo</TableCell>
              <TableCell>Filiale</TableCell>
              <TableCell>Nr.</TableCell>
              <TableCell>Ort</TableCell>
              <TableCell>Bundesland</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && branches.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Noch keine Filiale angelegt.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {branches.map((b) => (
              <TableRow key={b.id} hover sx={{ opacity: b.active ? 1 : 0.55 }}>
                <TableCell>
                  <Avatar src={b.logoBase64 ?? undefined} variant="rounded" sx={{ bgcolor: '#eef3f1' }}>
                    <StoreOutlinedIcon sx={{ color: '#2f5d50' }} fontSize="small" />
                  </Avatar>
                </TableCell>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.branchNumber}</TableCell>
                <TableCell>{b.address.city || '-'}</TableCell>
                <TableCell>{b.federalState}</TableCell>
                <TableCell>
                  <Chip size="small" label={b.active ? 'Aktiv' : 'Inaktiv'} color={b.active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {dialog && (
        <BranchDialog branch={dialog.branch} onClose={() => setDialog(null)} onSaved={reload} onError={report} />
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

      <ErrorSnackbar error={error} onClose={reset} />
    </Box>
  );
}
