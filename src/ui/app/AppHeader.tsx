import type { Ref } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useTranslation } from 'react-i18next';
import { useBranchList } from '@ui/hooks/useBranch';
import { useBranchSelectionStore } from '@ui/app/store/branchSelectionStore';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';

interface AppHeaderProps {
  /** Forwarded to AppShell's ResizeObserver, which publishes --pep-header-height for
   * ScheduleToolbar's own sticky positioning. */
  headerRef?: Ref<HTMLElement>;
}

/**
 * Filiale switcher, extracted verbatim from AppShell.tsx's previous inline JSX so every
 * breakpoint reuses the same instance instead of copies of the Filiale-select logic.
 */
export function AppHeader({ headerRef }: AppHeaderProps) {
  const { branches } = useBranchList();
  const activeBranches = branches.filter((b) => b.active);
  const selectedBranchId = useBranchSelectionStore((s) => s.selectedBranchId);
  const setSelectedBranch = useBranchSelectionStore((s) => s.setSelectedBranch);
  const isMobile = useBreakpoint() === 'mobile';
  const { t } = useTranslation('app');

  // Truncates with an ellipsis instead of the Select auto-sizing to the branch name - only visible
  // on mobile, where the Select is width-constrained (flex:1, minWidth:0) below; at every other
  // breakpoint nothing bounds its width, so this renders exactly as the plain MenuItem text would.
  const renderBranchValue = (value: string) => {
    const b = activeBranches.find((br) => br.id === value);
    return (
      <Typography noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {b ? `${b.branchNumber} - ${b.name}` : ''}
      </Typography>
    );
  };

  return (
    <AppBar ref={headerRef} position="sticky" color="transparent" sx={{ top: 0, backgroundColor: 'background.paper' }}>
      <Toolbar sx={{ gap: isMobile ? 1.5 : 3, flexWrap: isMobile ? 'nowrap' : 'wrap', py: 1 }}>
        {activeBranches.length > 0 && (
          <Select
            size="small"
            value={selectedBranchId ?? ''}
            onChange={(e) => setSelectedBranch(e.target.value as never)}
            renderValue={renderBranchValue}
            // A top-level aria-label prop lands on Select's outer MuiInputBase-root wrapper, not
            // the inner role="combobox" element that actually needs the accessible name -
            // inputProps is what Select forwards down to that inner element.
            inputProps={{ 'aria-label': t('branchSelect') }}
            sx={isMobile ? { flex: 1, minWidth: 0 } : { flex: 1, minWidth: 220 }}
          >
            {activeBranches.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.branchNumber} - {b.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </Toolbar>
    </AppBar>
  );
}
