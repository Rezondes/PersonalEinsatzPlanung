import type { ReactNode, Ref } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useBranchList } from '@ui/hooks/useBranch';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';

interface AppHeaderProps {
  /** Forwarded to AppShell's ResizeObserver, which publishes --pep-header-height for
   * ScheduleToolbar's own sticky positioning. */
  headerRef?: Ref<HTMLElement>;
  /** The breakpoint-specific nav slot: LaptopNav at the laptop breakpoint, or nothing when
   * navigation lives elsewhere - BottomTabBar on mobile, NavRail at both tablet breakpoints. */
  nav?: ReactNode;
}

/**
 * Logo + Filiale switcher, extracted verbatim from AppShell.tsx's previous inline JSX so every
 * breakpoint that shows a top bar (laptop, tablet portrait, and the content column at tablet
 * landscape) reuses the same instance instead of four copies of the Filiale-select logic.
 */
export function AppHeader({ headerRef, nav }: AppHeaderProps) {
  const { branches } = useBranchList();
  const activeBranches = branches.filter((b) => b.active);
  const selectedBranchId = useBranchSelectionStore((s) => s.selectedBranchId);
  const setSelectedBranch = useBranchSelectionStore((s) => s.setSelectedBranch);

  return (
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

        {nav}
      </Toolbar>
    </AppBar>
  );
}
