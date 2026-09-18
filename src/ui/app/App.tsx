import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useSuppressBrowserContextMenu } from '@ui/hooks/useSuppressBrowserContextMenu';
// Imported for its side effect: the module catches beforeinstallprompt while the page loads, well
// before the Einstellungen page exists. Nothing here uses an export of it.
import '@ui/app/installPrompt';
import { createAppTheme } from './theme';
import { useThemeModeStore } from './store/themeModeStore';
import { useAccentColorStore } from './store/accentColorStore';
import { usePrefersDarkMode } from '@ui/hooks/usePrefersDarkMode';
import { router } from './router';
import { UpdatePrompt } from './UpdatePrompt';
import { AppNotifications } from './AppNotifications';
import { InstallPromptBanner } from './InstallPromptBanner';

export function App() {
  // Here and not in AppShell: the print route sits outside the shell, and both of these have to
  // hold everywhere. See the two modules for the details.
  useSuppressBrowserContextMenu();
  const mode = useThemeModeStore((s) => s.mode);
  const accentColor = useAccentColorStore((s) => s.accentColor);
  const prefersDark = usePrefersDarkMode();
  const theme = createAppTheme({ mode, prefersDark, accentColor });

  // index.html's static <meta name="theme-color"> only covers the initial paint (it was picked to
  // match the header's own light-mode background, see its comment there) - keep the OS/browser
  // chrome (Android status bar, installed-PWA title bar) in sync with the header's live color once
  // the user's actual mode/accent resolves, same idea as LocaleRoot.tsx syncing <html lang>.
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.palette.background.paper);
  }, [theme.palette.background.paper]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
      <UpdatePrompt />
      <AppNotifications />
      <InstallPromptBanner />
    </ThemeProvider>
  );
}
