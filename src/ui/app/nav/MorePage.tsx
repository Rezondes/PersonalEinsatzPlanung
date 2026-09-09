import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { FOOTER_NAV_ITEMS, MAIN_NAV_ITEMS } from './navItems';

const FILIALEN = MAIN_NAV_ITEMS.find((i) => i.path === '/branches')!;

/**
 * Mobile-only "Mehr" tab destination: a menu hub, not a merged view of Filialen+Einstellungen
 * content. Tapping an entry navigates to the existing full page (/branches, /settings, /privacy),
 * which gets its own responsive treatment there rather than being duplicated here - see the
 * approved plan's rationale for this simplification versus the mockup's inline-cards version.
 */
export function MorePage() {
  const navigate = useNavigate();
  const entries = [FILIALEN, ...FOOTER_NAV_ITEMS];

  return (
    <Box>
      <Typography variant="h5" fontWeight={500} sx={{ mb: 2 }}>
        Mehr
      </Typography>
      <List sx={{ bgcolor: 'background.paper', border: '1px solid #e0e0dc', borderRadius: 2, overflow: 'hidden' }}>
        {entries.map((item) => (
          <ListItemButton key={item.path} onClick={() => navigate(item.path)} divider>
            <ListItemIcon>
              <item.icon />
            </ListItemIcon>
            <ListItemText primary={item.label} />
            <ChevronRightIcon sx={{ color: 'rgba(0,0,0,0.38)' }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
