import { forwardRef, useId } from 'react';
import type { ReactElement, ReactNode, Ref } from 'react';
import Dialog from '@mui/material/Dialog';
import type { DialogProps } from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Slide from '@mui/material/Slide';
import type { TransitionProps } from '@mui/material/transitions';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import CloseIcon from '@mui/icons-material/Close';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useDismissOnBack } from '@ui/hooks/useDismissOnBack';
import type { RowAction } from './ResponsiveList/RowAction';

const SlideUpTransition = forwardRef(function SlideUpTransition(
  props: TransitionProps & { children: ReactElement },
  ref: Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface ResponsiveDialogProps {
  open: boolean;
  /** `undefined` while a save/delete/import is in flight, matching ConfirmDialog's `busy` pattern -
   * both Escape and a backdrop click become no-ops, exactly like a plain MUI Dialog with no
   * onClose. */
  onClose: (() => void) | undefined;
  title: ReactNode;
  /** Second line in the full-screen header only - the centered laptop DialogTitle has no room for
   * it and none of today's dialogs show one there either. */
  subtitle?: ReactNode;
  /** The dialog's own footer content (Abbrechen/Speichern, FormErrorNotice...) - kept as a prop
   * rather than owned here since disabled/busy state differs per dialog. */
  actions: ReactNode;
  /** Rendered as a labelled "Weitere Aktionen" section at the end of the form, full-screen only -
   * matches the mockup's edit sheet, and reuses the exact RowAction[] each list view already
   * builds for its long-press sheet (see ResponsiveList/RowAction.ts) rather than a second copy of
   * the same actions. Omitted at laptop, where the centered dialog keeps its existing separate
   * hover-icon affordance for these. */
  secondaryActions?: RowAction[];
  children: ReactNode;
  maxWidth?: DialogProps['maxWidth'];
  dividers?: boolean;
  contentRef?: Ref<HTMLDivElement>;
}

/**
 * Shared shell so every data-entry dialog becomes a full-screen sheet below the laptop breakpoint
 * (MUI's documented `fullScreen` + slide-up `TransitionComponent` recipe) and stays today's
 * centered dialog at laptop - zero behavior change there. Only the close affordance differs per
 * mode (a top-left X `IconButton` full-screen vs. the dialog's own "Abbrechen" button, which every
 * caller already renders in `actions`); `onClose`, validation, and `busy` behavior are untouched.
 */
export function ResponsiveDialog({
  open,
  onClose,
  title,
  subtitle,
  actions,
  secondaryActions,
  children,
  maxWidth = 'sm',
  dividers,
  contentRef,
}: ResponsiveDialogProps) {
  const layout = useBreakpoint();
  const fullScreen = layout !== 'laptop';
  useDismissOnBack(open && fullScreen, () => onClose?.());
  // MUI's Dialog normally learns its aria-labelledby from a child DialogTitle via context; the
  // full-screen branch below doesn't render one, so that wiring is done by hand here instead -
  // without it the dialog has no accessible name in either mode once a custom header exists.
  const titleId = useId();
  const subtitleId = useId();
  const labelledBy = fullScreen && subtitle ? `${titleId} ${subtitleId}` : titleId;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth={fullScreen ? undefined : maxWidth}
      fullWidth={!fullScreen}
      TransitionComponent={fullScreen ? SlideUpTransition : undefined}
      aria-labelledby={labelledBy}
    >
      {fullScreen ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            height: 56,
            px: 1,
            flexShrink: 0,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <IconButton onClick={onClose} disabled={!onClose} aria-label="Schließen">
            <CloseIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id={titleId} variant="subtitle1" fontWeight={500} noWrap>
              {title}
            </Typography>
            {subtitle && (
              <Typography id={subtitleId} variant="caption" color="text.secondary" noWrap display="block">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      ) : (
        <DialogTitle id={titleId}>
          {title}
          {subtitle && (
            <Typography id={subtitleId} variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </DialogTitle>
      )}

      <DialogContent ref={contentRef} dividers={dividers}>
        {children}

        {fullScreen && secondaryActions && secondaryActions.length > 0 && (
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 1, letterSpacing: '0.04em' }}
            >
              Weitere Aktionen
            </Typography>
            <Stack spacing={1}>
              {secondaryActions.map((action) => (
                <Button
                  key={action.key}
                  variant="outlined"
                  color={action.dangerous ? 'error' : 'primary'}
                  startIcon={<action.icon />}
                  disabled={action.disabled}
                  onClick={() => {
                    onClose?.();
                    action.onSelect();
                  }}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={
          fullScreen
            ? {
                position: 'sticky',
                bottom: 0,
                bgcolor: 'background.paper',
                borderTop: '1px solid',
                borderColor: 'divider',
                px: 2,
                py: 1.5,
                flexShrink: 0,
              }
            : { px: 3, pb: 2 }
        }
      >
        {actions}
      </DialogActions>
    </Dialog>
  );
}
