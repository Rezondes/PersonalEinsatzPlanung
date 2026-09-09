import type { ReactNode } from 'react';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
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
  return (
    <SwipeableDrawer anchor="bottom" open={open} onClose={onClose} onOpen={() => {}} disableSwipeToOpen>
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: '#cfcfc9' }} />
      </Box>
      <Box sx={{ px: 2.5, pb: 1 }}>
        <Typography variant="subtitle1" fontWeight={500} noWrap>
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
          onClick={() => {
            onClose();
            action.onSelect();
          }}
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
          Abbrechen
        </Button>
      </Box>
    </SwipeableDrawer>
  );
}
