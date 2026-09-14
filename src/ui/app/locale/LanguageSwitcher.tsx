import { Link, useLocation } from 'react-router-dom';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import type { Locale } from './locale';
import { SUPPORTED_LOCALES, buildLocalizedPath, stripLocalePrefix } from './locale';
import { useLocale } from './useLocale';

const LOCALE_LABELS: Record<Locale, string> = {
  de: 'Deutsch',
};

/**
 * Not wired into SettingsView yet - only German is supported today (see src/domain/CLAUDE.md's
 * "UI-facing strings stay German" rule, which this doesn't change). Lists every SUPPORTED_LOCALES
 * entry and links each to the equivalent path under that locale, so adding a second locale later
 * needs no changes here - it renders a single, already-active entry until then.
 */
export function LanguageSwitcher() {
  const currentLocale = useLocale();
  const { pathname } = useLocation();
  const restOfPath = stripLocalePrefix(pathname, currentLocale);

  return (
    <List>
      {SUPPORTED_LOCALES.map((candidate) => (
        <ListItemButton
          key={candidate}
          component={Link}
          to={buildLocalizedPath(candidate, restOfPath)}
          selected={candidate === currentLocale}
        >
          <ListItemText primary={LOCALE_LABELS[candidate]} />
        </ListItemButton>
      ))}
    </List>
  );
}
