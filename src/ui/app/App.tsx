import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { RouterProvider } from 'react-router-dom';
import { useSuppressBrowserContextMenu } from '@ui/hooks/useSuppressBrowserContextMenu';
// Imported for its side effect: the module catches beforeinstallprompt while the page loads, well
// before the Einstellungen page exists. Nothing here uses an export of it.
import '@ui/app/installPrompt';
import { theme } from './theme';
import { router } from './router';
import { UpdatePrompt } from './UpdatePrompt';
import { AppNotifications } from './AppNotifications';

export function App() {
  // Here and not in AppShell: the print route sits outside the shell, and both of these have to
  // hold everywhere. See the two modules for the details.
  useSuppressBrowserContextMenu();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
      <UpdatePrompt />
      <AppNotifications />
    </ThemeProvider>
  );
}
