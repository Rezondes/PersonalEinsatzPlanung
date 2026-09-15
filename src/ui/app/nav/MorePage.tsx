import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { usePageActions } from '@ui/app/PageActionsContext';
import type { NavItem } from './navItems';
import { FOOTER_NAV_ITEMS, MAIN_NAV_ITEMS } from './navItems';
import { useLocale } from '../locale/useLocale';
import { buildLocalizedPath } from '../locale/locale';

/** Filialen leads (it's the one MAIN_NAV_ITEMS entry not otherwise reachable from this hub) unless
 * a future rename ever drops it from MAIN_NAV_ITEMS - falls back to the footer items alone rather
 * than crashing the whole page on a `.find(...)!` that came back empty (N14). */
export function buildMoreEntries(mainNavItems: NavItem[], footerNavItems: NavItem[]): NavItem[] {
  const filialen = mainNavItems.find((i) => i.path === '/branches');
  return filialen ? [filialen, ...footerNavItems] : footerNavItems;
}

/**
 * Mobile-only "Mehr" tab destination: a menu hub, not a merged view of Filialen+Einstellungen
 * content. Tapping an entry navigates to the existing full page (/branches, /settings, /privacy),
 * which gets its own responsive treatment there rather than being duplicated here - see the
 * approved plan's rationale for this simplification versus the mockup's inline-cards version.
 */
export function MorePage() {
  const navigate = useNavigate();
  const layout = useBreakpoint();
  const locale = useLocale();
  const { t } = useTranslation('nav');
  usePageActions({ fullBleedPage: true });
  const entries = buildMoreEntries(MAIN_NAV_ITEMS, FOOTER_NAV_ITEMS);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        px: layout === 'mobile' ? 1.5 : 3,
        py: layout === 'mobile' ? 1.5 : 3,
      }}
    >
      <Typography variant="h5" component="h1" fontWeight={500} sx={{ mb: 2 }}>
        {t('more')}
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <List sx={{ bgcolor: 'background.paper', border: '1px solid #e0e0dc', borderRadius: 2, overflow: 'hidden' }}>
          {entries.map((item) => (
            <ListItemButton key={item.path} onClick={() => navigate(buildLocalizedPath(locale, item.path))} divider>
              <ListItemIcon>
                <item.icon />
              </ListItemIcon>
              <ListItemText primary={t(item.label)} />
              <ChevronRightIcon sx={{ color: 'rgba(0,0,0,0.38)' }} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Box>
  );
}
