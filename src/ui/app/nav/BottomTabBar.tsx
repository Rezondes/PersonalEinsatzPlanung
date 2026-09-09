import { useLocation, useNavigate } from 'react-router-dom';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import { BOTTOM_TABS } from './navItems';

/** Which tab, if any, should show as active for the current path - the "Mehr" tab also covers
 * /branches, /settings and /privacy, since those are only reached through it. */
function activeTabPath(pathname: string): string | false {
  const tab = BOTTOM_TABS.find(
    (t) => pathname === t.path || pathname.startsWith(`${t.path}/`) || t.matchPaths?.some((p) => pathname.startsWith(p)),
  );
  return tab?.path ?? false;
}

/** Mobile-only fixed bottom navigation, 5 tabs. Sits at `zIndex: theme.zIndex.appBar` (same tier
 * as the top AppBar at other breakpoints) so it stacks correctly under Dialogs/Snackbars. */
export function BottomTabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderTop: '1px solid #e0e0dc',
        borderRadius: 0,
        pb: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <BottomNavigation showLabels value={activeTabPath(pathname)} onChange={(_e, value: string) => navigate(value)}>
        {BOTTOM_TABS.map((tab) => (
          <BottomNavigationAction
            key={tab.path}
            label={tab.shortLabel ?? tab.label}
            value={tab.path}
            icon={<tab.icon />}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
