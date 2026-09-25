import { NavLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import { useTranslation } from 'react-i18next';
import { MAIN_NAV_ITEMS, NAV_RAIL_FOOTER_ITEMS } from './navItems';
import { NAV_LINK_CLASS } from './navLinkStyle';
import { useNavRailStore } from '../store/navRailStore';
import { useLocale } from '../locale/useLocale';
import { buildLocalizedPath } from '../locale/locale';

const EXPANDED_WIDTH = 216;
const COLLAPSED_WIDTH = 72;

/** Layout-only style, kept separate from navLinkStyle.ts's shared function rather than merged into
 * it: that function's fixed `padding: '6px 10px'` is sized for LaptopNav's text-only pills and
 * would collide with the collapse-aware padding the inner Box below already manages (0 when
 * collapsed, so the icon can center in the full rail width) plus this row's own fixed 48px height.
 * Only the CSS class (NAV_LINK_CLASS, applied on the NavLink itself below) is shared with
 * LaptopNav - that is what gives theme.ts's `.pep-nav-link:active` press-feedback rule effect here
 * too; the values below stay independent since the color/weight/background logic is otherwise
 * identical to navLinkStyle by design, just carried by different layout properties. */
// A factory, not a module-level constant: react-router's NavLink `style` prop only ever receives
// `{ isActive }`, with no theme access of its own, so the accent color has to be closed over from
// whichever theme is live when the component renders - called once per render from NavRail's own
// body, where useTheme() is available.
function makeRailLinkStyle(theme: Theme) {
  return ({ isActive }: { isActive: boolean }) => ({
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
    fontWeight: isActive ? 500 : 400,
    fontSize: 14,
    borderRadius: 8,
    // undefined, not 'transparent': an inline background-color - even 'transparent' - always beats
    // the shared .pep-nav-link:active CSS rule for the same property (see navLinkStyle.ts, which
    // had the identical issue), which would otherwise silently keep this rail's own tap feedback
    // from ever showing.
    backgroundColor: isActive ? theme.palette.accentSurface.subtle : undefined,
  });
}

/**
 * Collapsible left navigation rail, shown at the tablet breakpoint (768px and up). Mobile gets its
 * own bottom tab bar instead; this rail is the only chrome anywhere from tablet width up. Only the
 * rail itself lives here - the Filiale switcher, undo/redo, Drucken etc. sit in the content
 * column's own AppHeader to the right, not in the rail.
 */
export function NavRail() {
  const collapsed = useNavRailStore((s) => s.collapsed);
  const toggle = useNavRailStore((s) => s.toggle);
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const locale = useLocale();
  const { t } = useTranslation('nav');
  const theme = useTheme();
  const railLinkStyle = makeRailLinkStyle(theme);

  return (
    <Box
      component="nav"
      sx={{
        flexShrink: 0,
        width,
        transition: 'width 150ms ease',
        backgroundColor: theme.palette.background.paper,
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <ButtonBase
        onClick={toggle}
        aria-label={collapsed ? t('expandNavAriaLabel') : t('collapseNavAriaLabel')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: 'var(--pep-header-height, 64px)',
          flexShrink: 0,
        }}
      >
        {collapsed ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
      </ButtonBase>

      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5, overflowY: 'auto' }}>
        {MAIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={buildLocalizedPath(locale, item.path)}
            title={t(item.label)}
            aria-label={t(item.label)}
            style={railLinkStyle}
            className={NAV_LINK_CLASS}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                height: 48,
                width: '100%',
                px: collapsed ? 0 : 1.5,
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
            >
              <item.icon fontSize="small" sx={{ flexShrink: 0 }} />
              {!collapsed && <Typography noWrap>{t(item.label)}</Typography>}
            </Box>
          </NavLink>
        ))}
      </Box>

      <Box sx={{ flex: 1 }} />

      <Box sx={{ p: 1, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {NAV_RAIL_FOOTER_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={buildLocalizedPath(locale, item.path)}
            title={t(item.label)}
            aria-label={t(item.label)}
            style={railLinkStyle}
            className={NAV_LINK_CLASS}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                height: 48,
                width: '100%',
                px: collapsed ? 0 : 1.5,
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
            >
              <item.icon fontSize="small" sx={{ flexShrink: 0 }} />
              {!collapsed && <Typography noWrap>{t(item.label)}</Typography>}
            </Box>
          </NavLink>
        ))}
      </Box>
    </Box>
  );
}
