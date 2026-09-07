import { createTheme } from '@mui/material/styles';
import { deDE } from '@mui/material/locale';

/**
 * Custom, understated theme instead of MUI defaults: reduced elevation (no shadows), muted
 * neutral palette with one accent color, generous spacing. Goal: familiar Material interaction
 * patterns (important for non-tech-savvy users), but a calm, clean look.
 */
export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: { main: '#2f5d50' },
      background: { default: '#f7f7f5', paper: '#ffffff' },
      error: { main: '#b3261e' },
      warning: { main: '#8a5a00' },
      success: { main: '#2f6b3f' },
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none', border: '1px solid #e0e0dc' } },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { borderBottom: '1px solid #e0e0dc' } },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { border: '1px solid #e0e0dc' } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
      },
      MuiTableCell: {
        styleOverrides: { root: { borderColor: '#ececeb' } },
      },
    },
  },
  deDE,
);
