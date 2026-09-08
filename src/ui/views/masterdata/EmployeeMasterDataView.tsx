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
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import ChildCareOutlinedIcon from '@mui/icons-material/ChildCareOutlined';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import { employmentTypeLabel } from '@domain/employee/EmploymentType';
import { isMinor } from '@domain/validation/arbzg/youthProtection';
import { services } from '@infrastructure/services';
import { useSelectedBranch } from '@ui/hooks/useBranch';
import { useEmployeeList } from '@ui/hooks/useEmployeeList';
import { useErrorSnackbar } from '@ui/hooks/useErrorSnackbar';
import { ErrorSnackbar } from '@ui/components/ErrorSnackbar';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { EmployeeDialog } from './EmployeeDialog';

export function EmployeeMasterDataView() {
  const { branch } = useSelectedBranch();
  const { employeeList, loading, reload } = useEmployeeList(branch?.id ?? null);
  // null = closed; { employee: null } = "Neuer Mitarbeiter"; { employee } = edit. The dialog is
  // mounted only while open so its form state starts fresh each time.
  const [dialog, setDialog] = useState<{ employee: Employee | null } | null>(null);
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const { error, report, reset } = useErrorSnackbar();

  const changeStatus = async () => {
    if (!statusTarget) return;
    try {
      await services.employee.changeActiveStatus(statusTarget, !statusTarget.active);
      await reload();
    } catch (e) {
      report(e, 'Status konnte nicht geändert werden');
    } finally {
      setStatusTarget(null);
    }
  };

  if (!branch) {
    return <Alert severity="info">Bitte zuerst oben eine Filiale auswählen oder anlegen.</Alert>;
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={500}>
          Mitarbeiter · {branch.name}
        </Typography>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialog({ employee: null })}>
          Neuer Mitarbeiter
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Tätigkeit</TableCell>
              <TableCell>Beschäftigung</TableCell>
              <TableCell>Wochenstunden</TableCell>
              <TableCell>Urlaub/Jahr</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && employeeList.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    Noch kein Mitarbeiter angelegt.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {employeeList.map((emp) => {
              const minor = isMinor(emp.birthDate, new Date());
              return (
                <TableRow key={emp.id} hover sx={{ opacity: emp.active ? 1 : 0.55 }}>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {fullName(emp)}
                      {minor && (
                        <ChildCareOutlinedIcon
                          fontSize="small"
                          sx={{ color: 'text.secondary' }}
                          titleAccess="Minderjährig — Jugendarbeitsschutz beachten"
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{emp.jobTitle}</TableCell>
                  <TableCell>
                    <Chip size="small" label={employmentTypeLabel(emp.employmentType)} />
                  </TableCell>
                  <TableCell>
                    {emp.employmentType.type === 'Minijob'
                      ? `${emp.employmentType.minHours.toLocaleString('de-DE')}-${emp.employmentType.maxHours.toLocaleString('de-DE')}`
                      : emp.employmentType.weeklyHours.toLocaleString('de-DE')}
                  </TableCell>
                  <TableCell>{emp.vacationEntitlementPerYear.toLocaleString('de-DE')}</TableCell>
                  <TableCell>
                    <Chip size="small" label={emp.active ? 'Aktiv' : 'Inaktiv'} color={emp.active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setDialog({ employee: emp })} aria-label={`${fullName(emp)} bearbeiten`}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setStatusTarget(emp)}
                      aria-label={emp.active ? `${fullName(emp)} deaktivieren` : `${fullName(emp)} aktivieren`}
                    >
                      {emp.active ? <ToggleOnOutlinedIcon fontSize="small" /> : <ToggleOffOutlinedIcon fontSize="small" />}
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {dialog && (
        <EmployeeDialog
          branchId={branch.id}
          employee={dialog.employee}
          onClose={() => setDialog(null)}
          onSaved={reload}
          onError={report}
        />
      )}

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.active ? 'Mitarbeiter deaktivieren?' : 'Mitarbeiter aktivieren?'}
        text={
          statusTarget?.active
            ? `${statusTarget ? fullName(statusTarget) : ''} wird als inaktiv markiert und erscheint nicht mehr in neuen Wochenplänen. Bereits erfasste Wochenpläne und Abwesenheiten bleiben vollständig erhalten, der Mitarbeiter kann jederzeit wieder aktiviert werden.`
            : `${statusTarget ? fullName(statusTarget) : ''} wird wieder als aktiv markiert.`
        }
        confirmText={statusTarget?.active ? 'Deaktivieren' : 'Aktivieren'}
        onConfirm={changeStatus}
        onCancel={() => setStatusTarget(null)}
      />

      <ErrorSnackbar error={error} onClose={reset} />
    </Box>
  );
}
