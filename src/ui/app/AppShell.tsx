import { Outlet, NavLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import { useFilialenListe } from '@ui/hooks/useFiliale';
import { useFilialeAuswahlStore } from '@ui/app/store/filialeAuswahlStore';

const NAV_LINKS = [
  { pfad: '/wochenplan', label: 'Wochenplanung' },
  { pfad: '/monat', label: 'Monatsübersicht' },
  { pfad: '/mitarbeiter', label: 'Mitarbeiter' },
  { pfad: '/abwesenheiten', label: 'Abwesenheiten' },
  { pfad: '/filialen', label: 'Filialen' },
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
  const { filialen } = useFilialenListe();
  const aktiveFilialen = filialen.filter((f) => f.aktiv);
  const ausgewaehlteFilialeId = useFilialeAuswahlStore((s) => s.ausgewaehlteFilialeId);
  const setAusgewaehlteFiliale = useFilialeAuswahlStore((s) => s.setAusgewaehlteFiliale);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar position="static" color="transparent" sx={{ backgroundColor: '#ffffff' }}>
        <Toolbar sx={{ gap: 3, flexWrap: 'wrap', py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StoreOutlinedIcon sx={{ color: '#2f5d50' }} />
            <Typography variant="subtitle1" fontWeight={500}>
              Personaleinsatzplanung
            </Typography>
          </Box>

          {aktiveFilialen.length > 0 && (
            <Select
              size="small"
              value={ausgewaehlteFilialeId ?? ''}
              onChange={(e) => setAusgewaehlteFiliale(e.target.value as never)}
              sx={{ minWidth: 220 }}
            >
              {aktiveFilialen.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.filialnummer} - {f.name}
                </MenuItem>
              ))}
            </Select>
          )}

          <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, flexWrap: 'wrap' }}>
            {NAV_LINKS.map((link) => (
              <NavLink key={link.pfad} to={link.pfad} style={navLinkStyle}>
                {link.label}
              </NavLink>
            ))}
          </Box>

          <NavLink to="/datenschutz" style={navLinkStyle}>
            Datenschutz
          </NavLink>
          <NavLink to="/einstellungen" style={navLinkStyle}>
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
