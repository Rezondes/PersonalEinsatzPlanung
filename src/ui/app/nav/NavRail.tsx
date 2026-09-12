import { NavLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import { MAIN_NAV_ITEMS, FOOTER_NAV_ITEMS } from './navItems';
import { NAV_LINK_CLASS } from './navLinkStyle';
import { useNavRailStore } from '../store/navRailStore';
import { APP_VERSION } from '../buildInfo';

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
const railLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  display: 'flex',
  alignItems: 'center',
  textDecoration: 'none',
  color: isActive ? '#2f5d50' : '#4b4b47',
  fontWeight: isActive ? 500 : 400,
  fontSize: 14,
  borderRadius: 8,
  // undefined, not 'transparent': an inline background-color - even 'transparent' - always beats
  // the shared .pep-nav-link:active CSS rule for the same property (see navLinkStyle.ts, which
  // had the identical issue), which would otherwise silently keep this rail's own tap feedback
  // from ever showing.
  backgroundColor: isActive ? '#eef3f1' : undefined,
});

/**
 * Collapsible left navigation rail, shown at BOTH tablet breakpoints (768-1279px, portrait and
 * landscape) - not landscape only. Only mobile (bottom tab bar) and laptop (horizontal top nav)
 * get their own chrome; everything in between uses this rail, per an explicit correction to the
 * original mockup-derived plan (which had a separate tablet-portrait pill-nav step) after seeing
 * it rendered live. Only the rail itself lives here - the Filiale switcher, undo/redo, Drucken etc.
 * sit in the content column's own AppHeader to the right, not in the rail.
 */
export function NavRail() {
  const collapsed = useNavRailStore((s) => s.collapsed);
  const toggle = useNavRailStore((s) => s.toggle);
  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <Box
      component="nav"
      sx={{
        flexShrink: 0,
        width,
        transition: 'width 150ms ease',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e0e0dc',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          height: 56,
          px: collapsed ? 0 : 2,
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid #e0e0dc',
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <>
            <Box component="img" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" sx={{ width: 24, height: 24, flexShrink: 0 }} />
            <Typography variant="subtitle2" fontWeight={500} sx={{ flex: 1, minWidth: 0 }}>
              Planung
            </Typography>
          </>
        )}
        <IconButton
          onClick={toggle}
          aria-label={collapsed ? 'Navigation ausklappen' : 'Navigation einklappen'}
          size="small"
        >
          {collapsed ? <MenuIcon /> : <MenuOpenIcon />}
        </IconButton>
      </Box>

      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5, overflowY: 'auto' }}>
        {MAIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            aria-label={item.label}
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
              {!collapsed && <Typography noWrap>{item.label}</Typography>}
            </Box>
          </NavLink>
        ))}
      </Box>

      <Box sx={{ flex: 1 }} />

      <Box sx={{ p: 1, borderTop: '1px solid #ececeb', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {FOOTER_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            aria-label={item.label}
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
              <item.icon fontSize="small" sx={{ flexShrink: 0, color: 'rgba(0,0,0,0.54)' }} />
              {!collapsed && <Typography noWrap>{item.label}</Typography>}
            </Box>
          </NavLink>
        ))}
        {!collapsed && (
          <Typography variant="caption" sx={{ px: 1.5, pt: 0.5, color: 'rgba(0, 0, 0, 0.6)' }}>
            {APP_VERSION}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
