import { useTranslation } from 'react-i18next';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined';
import { WEEK_SIDE_PANEL_ID } from './WeekSidePanel';

interface WeekSidePanelToggleProps {
  open: boolean;
  onToggle: () => void;
  errorCount: number;
  warningCount: number;
}

/**
 * Opens/closes the "Wochendetails" panel. Its badge keeps ArbZG findings visible while the panel
 * is collapsed: the error count in error colour, otherwise the warning count in warning colour,
 * otherwise nothing. The count is part of the accessible name, so the badge itself is aria-hidden.
 */
export function WeekSidePanelToggle({ open, onToggle, errorCount, warningCount }: WeekSidePanelToggleProps) {
  const { t } = useTranslation('schedule');
  const action = open ? t('sidePanelHide') : t('sidePanelShow');
  const badge =
    errorCount > 0
      ? { count: errorCount, color: 'error' as const, text: t('errorSummary', { count: errorCount }) }
      : warningCount > 0
        ? { count: warningCount, color: 'warning' as const, text: t('warningSummary', { count: warningCount }) }
        : null;
  const label = badge ? `${action}, ${badge.text}` : action;

  // The Tooltip wraps the button itself, not the Badge: on the Badge's plain span it would set an
  // aria-label, which a generic element must not carry.
  const button = (
    <Tooltip title={action}>
      <IconButton onClick={onToggle} aria-label={label} aria-expanded={open} aria-controls={WEEK_SIDE_PANEL_ID}>
        <ViewSidebarOutlinedIcon />
      </IconButton>
    </Tooltip>
  );

  return badge ? (
    <Badge badgeContent={badge.count} color={badge.color} slotProps={{ badge: { 'aria-hidden': true } }}>
      {button}
    </Badge>
  ) : (
    button
  );
}
