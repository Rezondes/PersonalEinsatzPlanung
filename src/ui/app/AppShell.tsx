import { useLayoutEffect, useRef } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { BuildVersionBadge } from '@ui/components/BuildVersionBadge';
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

/**
 * The class exists only so theme.ts can give these links a :active state. The global
 * -webkit-tap-highlight-color: transparent removes the browser's own touch feedback, and these are
 * bare anchors without MUI's ripple - without a replacement, tapping a nav entry on a tablet gives
 * no feedback at all until the route swaps. Inline styles cannot carry a pseudo-class, hence a class.
 */
export const NAV_LINK_CLASS = 'pep-nav-link';

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
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // The header's toolbar wraps at narrow widths, so its height is not a constant. Publishing it as
  // a CSS custom property lets a sticky element below it (the Wochenplanung toolbar) dock exactly
  // underneath without hardcoding 64px. Written straight to the DOM, deliberately not via state:
  // a resize must not re-render the whole shell.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const header = headerRef.current;
    if (!root || !header) return;

    const publish = () => root.style.setProperty('--pep-header-height', `${header.offsetHeight}px`);
    publish();

    // jsdom has no ResizeObserver and the app must still render in tests.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const { branches } = useBranchList();
  const activeBranches = branches.filter((b) => b.active);
  const selectedBranchId = useBranchSelectionStore((s) => s.selectedBranchId);
  const setSelectedBranch = useBranchSelectionStore((s) => s.setSelectedBranch);

  return (
    <Box ref={rootRef} sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar ref={headerRef} position="sticky" color="transparent" sx={{ top: 0, backgroundColor: '#ffffff' }}>
        <Toolbar sx={{ gap: 3, flexWrap: 'wrap', py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="img" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" sx={{ width: 24, height: 24 }} />
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
              <NavLink key={link.path} to={link.path} className={NAV_LINK_CLASS} style={navLinkStyle}>
                {link.label}
              </NavLink>
            ))}
          </Box>

          <NavLink to="/privacy" className={NAV_LINK_CLASS} style={navLinkStyle}>
            Datenschutz
          </NavLink>
          <NavLink to="/settings" className={NAV_LINK_CLASS} style={navLinkStyle}>
            Einstellungen
          </NavLink>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Outlet />
      </Container>

      <BuildVersionBadge />
    </Box>
  );
}
