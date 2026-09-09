import { NavLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import { MAIN_NAV_ITEMS, FOOTER_NAV_ITEMS } from './navItems';
import { NAV_LINK_CLASS, navLinkStyle } from './navLinkStyle';

/**
 * Today's desktop pill-row navigation (Wochenplanung...Filialen, then Datenschutz/Einstellungen
 * pinned at the end), extracted verbatim from AppShell.tsx's previous inline JSX - only the data
 * source changed (navItems.ts instead of a local NAV_LINKS const). Renders as a fragment because
 * it is placed directly inside AppHeader's flex Toolbar row, exactly where these elements sat
 * before: the first group flex-grows and wraps, the footer links stay pinned to the right.
 */
export function LaptopNav() {
  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, flexWrap: 'wrap' }}>
        {MAIN_NAV_ITEMS.map((item) => (
          <NavLink key={item.path} to={item.path} className={NAV_LINK_CLASS} style={navLinkStyle}>
            {item.label}
          </NavLink>
        ))}
      </Box>
      {FOOTER_NAV_ITEMS.map((item) => (
        <NavLink key={item.path} to={item.path} className={NAV_LINK_CLASS} style={navLinkStyle}>
          {item.label}
        </NavLink>
      ))}
    </>
  );
}
