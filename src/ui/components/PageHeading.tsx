import type { ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import { VISUALLY_HIDDEN_SX } from './visuallyHidden';

/** The page's h1, hidden on screen: the active nav entry already names the page, so a visible
 * heading only cost a row. Screen readers still announce it, and AppShell still focuses it after a
 * page change (it looks for `main h1`). */
export function PageHeading({ children }: { children: ReactNode }) {
  return (
    <Typography variant="h5" component="h1" sx={VISUALLY_HIDDEN_SX}>
      {children}
    </Typography>
  );
}
