import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useDismissOnBack } from '@ui/hooks/useDismissOnBack';
import type { RowAction } from './RowAction';

interface RowActionSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  actions: RowAction[];
}

/**
 * The bottom sheet opened by a long-press (mobile) or a "⋮" button (tablet) on a list row -
 * matches the mockup's action-sheet pattern (drag handle, entity summary, labelled actions with a
 * hint line, "Abbrechen"). `SwipeableDrawer` over a plain `Drawer` so it also closes on a
 * swipe-down, not just a tap on the scrim or Abbrechen - already ships in `@mui/material`, no new
 * dependency. `disableSwipeToOpen`: this is only ever opened imperatively (long-press/click), never
 * by an edge swipe, and an edge-swipe-to-open listener would be one more thing to keep from
 * fighting the schedule grid's own touch gestures later.
 */
export function RowActionSheet({ open, onClose, title, subtitle, actions }: RowActionSheetProps) {
  const { t } = useTranslation();
  const titleId = useId();
  useDismissOnBack(open, onClose);
  // Holds the chosen action until the sheet has actually finished closing (onExited) - firing it
  // in the same handler as onClose (this typically opens a ConfirmDialog) would build that
  // dialog's own focus trap while this sheet's is still tearing down, two focus traps racing over
  // where focus lands (N24). See ResponsiveDialog.tsx for the same fix on its secondaryActions,
  // and DriveBackupDialog.tsx's own delete-button comment for a sibling hazard in this same MUI
  // dialog-lifecycle family (a focus trap dropping focus on <body> instead of the trigger).
  const pendingActionRef = useRef<(() => void) | null>(null);

  const selectAction = (action: RowAction) => {
    pendingActionRef.current = action.onSelect;
    onClose();
  };

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      aria-labelledby={titleId}
      SlideProps={{
        onExited: () => {
          const pending = pendingActionRef.current;
          pendingActionRef.current = null;
          pending?.();
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
      </Box>
      <Box sx={{ px: 2.5, pb: 1 }}>
        <Typography id={titleId} variant="subtitle1" fontWeight={500} noWrap>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>

      {actions.map((action) => (
        <ButtonBase
          key={action.key}
          onClick={() => selectAction(action)}
          disabled={action.disabled}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.75,
            width: '100%',
            minHeight: 60,
            px: 2.5,
            py: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
            justifyContent: 'flex-start',
            textAlign: 'left',
            color: action.dangerous ? 'error.main' : 'text.primary',
          }}
        >
          <action.icon fontSize="small" sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={500} sx={{ color: 'inherit', lineHeight: 1.35 }}>
              {action.label}
            </Typography>
            {action.hint && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
                {action.hint}
              </Typography>
            )}
          </Box>
        </ButtonBase>
      ))}

      <Box sx={{ p: 2 }}>
        <Button fullWidth variant="outlined" onClick={onClose}>
          {t('cancel')}
        </Button>
      </Box>
    </SwipeableDrawer>
  );
}
