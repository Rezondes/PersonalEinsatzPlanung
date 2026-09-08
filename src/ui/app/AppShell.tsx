import { Outlet, NavLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import { useBranchList } from '@ui/hooks/useBranch';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';

const NAV_LINKS = [
  { path: '/schedule', label: 'Wochenplanung' },
  { path: '/month', label: 'Monatsübersicht' },
  { path: '/employees', label: 'Mitarbeiter' },
  { path: '/absences', label: 'Abwesenheiten' },
  { path: '/branches', label: 'Filialen' },
];

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  color: isActive ? '#2f5d50' : '#4b4b47',
  fontWeight: isActive ? 500 : 400,
  textDecoration: 'none',
  fontSize: 14,
  padding: '6px 10px',
  borderRadius: 8,
  backgroundColor: isActive ? '#eef3f1' : 'transparent',
});

export function AppShell() {
  const { branches } = useBranchList();
  const activeBranches = branches.filter((b) => b.active);
  const selectedBranchId = useBranchSelectionStore((s) => s.selectedBranchId);
  const setSelectedBranch = useBranchSelectionStore((s) => s.setSelectedBranch);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar position="sticky" color="transparent" sx={{ top: 0, backgroundColor: '#ffffff' }}>
        <Toolbar sx={{ gap: 3, flexWrap: 'wrap', py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="img" src="/favicon.svg" alt="" sx={{ width: 24, height: 24 }} />
            <Typography variant="subtitle1" fontWeight={500}>
              Personaleinsatzplanung
            </Typography>
          </Box>

          {activeBranches.length > 0 && (
            <Select
              size="small"
              value={selectedBranchId ?? ''}
              onChange={(e) => setSelectedBranch(e.target.value as never)}
              sx={{ minWidth: 220 }}
            >
              {activeBranches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.branchNumber} - {b.name}
                </MenuItem>
              ))}
            </Select>
          )}

          <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, flexWrap: 'wrap' }}>
            {NAV_LINKS.map((link) => (
              <NavLink key={link.path} to={link.path} style={navLinkStyle}>
                {link.label}
              </NavLink>
            ))}
          </Box>

          <NavLink to="/privacy" style={navLinkStyle}>
            Datenschutz
          </NavLink>
          <NavLink to="/settings" style={navLinkStyle}>
            Einstellungen
          </NavLink>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
