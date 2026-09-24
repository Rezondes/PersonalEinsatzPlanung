import { useLocation, useNavigate } from 'react-router-dom';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import { useTranslation } from 'react-i18next';
import { BOTTOM_TABS } from './navItems';
import { useLocale } from '../locale/useLocale';
import { buildLocalizedPath, stripLocalePrefix } from '../locale/locale';

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
  const locale = useLocale();
  const { t } = useTranslation('nav');
  const activeTab = activeTabPath(stripLocalePrefix(pathname, locale));

  return (
    <Paper
      component="nav"
      elevation={0}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderTop: '1px solid',
        borderColor: 'divider',
        borderRadius: 0,
        pb: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <BottomNavigation
        showLabels
        value={activeTab}
        onChange={(_e, value: string) => navigate(buildLocalizedPath(locale, value))}
      >
        {BOTTOM_TABS.map((tab) => (
          <BottomNavigationAction
            key={tab.path}
            label={t(tab.shortLabel ?? tab.label)}
            value={tab.path}
            icon={<tab.icon />}
            // MUI's own min-width is 80px: five tabs need 400px and clipped "Woche"/"Mehr" by 20px
            // each on a 360px phone. The short labels fit in an equal fifth of the bar.
            sx={{ minWidth: 0, flex: 1, px: 0.5 }}
            // Unlike NavRail (a plain NavLink, which sets this automatically), BottomNavigationAction
            // navigates programmatically via onChange, not an <a href> - so nothing marks the active
            // tab for assistive tech unless done by hand here.
            aria-current={tab.path === activeTab ? 'page' : undefined}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
