import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { ScheduleTool } from '../scheduleTools';
import { OFF_TOOL, toolKey, toolLabel, toolSummary } from '../scheduleTools';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';
import { useDismissOnBack } from '@ui/hooks/useDismissOnBack';

interface ScheduleToolbarProps {
  templates: ShiftTemplate[];
  activeTool: ScheduleTool | null;
  onSelect: (tool: ScheduleTool) => void;
  onCreate: () => void;
  onEdit: (template: ShiftTemplate) => void;
  onDelete: (template: ShiftTemplate) => void;
  /** True once a tile tap/click has armed tap-to-assign (see ScheduleView.selectTool) - at every
   * breakpoint, laptop included, so this is what actually gates whether the banner below shows. */
  assignModeActive: boolean;
  /** Clears assignModeActive AND the active tool - the banner's X and its "Fertig" button both call
   * this, matching the mockup's "Zuweisen beenden" affordance. */
  onFinishAssigning: () => void;
  /** True once the "Mehrfachauswahl" toggle armed selection mode (see ScheduleView.toggleSelectionMode)
   * - mutually exclusive with assignModeActive, enforced by the parent, never both at once. While
   * active, a tile tap applies the tool to every selected cell (onApplyToSelection) instead of
   * arming tap-to-assign (onSelect). */
  selectionModeActive: boolean;
  /** The toolbar's own toggle button - entering also cancels any in-progress tap-to-assign, leaving
   * clears it again (see onFinishSelecting for the banner's own, separate exit affordance). */
  onToggleSelectionMode: () => void;
  /** How many cells are currently marked in ScheduleTable - shown in the selection banner. Zero
   * still shows the banner (selection mode is active from the moment the toggle is pressed, not
   * only once the first cell is picked). */
  selectedCount: number;
  /** Applies `tool` to every currently selected cell in one step - every tile (Frei included) calls
   * this instead of onSelect while selectionModeActive is true. */
  onApplyToSelection: (tool: ScheduleTool) => void;
  /** Clears selectedCells AND selectionModeActive - the selection banner's X and its "Fertig" button
   * both call this, mirroring onFinishAssigning. */
  onFinishSelecting: () => void;
  /** Mobile-only "Aktionen" section of the "Weitere Aktionen" sheet - on laptop/tablet these stay
   * in ScheduleView's own header instead, which has room for them; only the collapsible (mobile)
   * branch below ever renders this section. */
  onCarryOver: () => void;
  /** Opens the H7 "replace this week with the previous week's shifts" confirmation - a separate,
   * clearly distinct action from onCarryOver above (which only transfers the Soll/Ist hour
   * difference, never touches actual shifts). */
  onCopyPreviousWeek: () => void;
  onPrint: () => void;
  printAvailable: boolean;
  /** Mobile-only "Wochenplanung" section of the sheet: ScheduleView's own <ScheduleHeaderFields>
   * element, relocated here specifically on mobile (there's no room to show it inline above the
   * table there) - rendered as-is, never rebuilt, so its loading/blur-save logic stays in one
   * place. Ignored by the non-collapsible (laptop/tablet) branch, which never renders this prop. */
  headerFields: ReactNode;
}

/**
 * The tool palette above the weekly grid. Every tile tap arms tap-to-assign at every breakpoint
 * (ScheduleView sets assignModeActive) - a click/Enter on a tile followed by a click/Enter on a
 * cell applies the tool. Tap-to-assign is the only interaction mode; there is no drag gesture.
 *
 * Chrome differs only at the narrowest class: tablet keeps a horizontal row. Only mobile collapses
 * the row into a "Vorlagen & Werkzeuge" bar that opens a bottom sheet.
 */
export function ScheduleToolbar({
  templates,
  activeTool,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  assignModeActive,
  onFinishAssigning,
  selectionModeActive,
  onToggleSelectionMode,
  selectedCount,
  onApplyToSelection,
  onFinishSelecting,
  onCarryOver,
  onCopyPreviousWeek,
  onPrint,
  printAvailable,
  headerFields,
}: ScheduleToolbarProps) {
  const { t } = useTranslation('schedule');
  const { t: tCommon } = useTranslation();
  const layout = useBreakpoint();
  const collapsible = layout === 'mobile';
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<{ template: ShiftTemplate; anchor: HTMLElement } | null>(null);
  useDismissOnBack(sheetOpen, () => setSheetOpen(false));

  const clipboardTool = activeTool?.kind === 'clipboard' ? activeTool : null;
  const tools: ScheduleTool[] = [
    OFF_TOOL,
    ...(clipboardTool ? [clipboardTool] : []),
    ...templates.map((template): ScheduleTool => ({ kind: 'template', template })),
  ];
  const activeKey = activeTool ? toolKey(activeTool) : null;

  const selectTool = (tool: ScheduleTool) => {
    if (selectionModeActive) {
      onApplyToSelection(tool);
    } else {
      onSelect(tool);
    }
    // The sheet is only ever how a touch user REACHES a tile - once armed/applied there is nothing
    // left to do inside it. Reopening it (tapping the banner) is how they switch tools mid-assignment
    // or mid-selection.
    if (collapsible) setSheetOpen(false);
  };

  const templateMenu = (
    <Menu open={!!menuFor} anchorEl={menuFor?.anchor ?? null} onClose={() => setMenuFor(null)}>
      <MenuItem
        onClick={() => {
          if (menuFor) onEdit(menuFor.template);
          setMenuFor(null);
        }}
      >
        {tCommon('edit')}
      </MenuItem>
      <MenuItem
        onClick={() => {
          if (menuFor) onDelete(menuFor.template);
          setMenuFor(null);
        }}
      >
        {tCommon('delete')}
      </MenuItem>
    </Menu>
  );

  // Shared by the laptop/tablet inline row and the mobile sheet - `vertical` switches between the
  // horizontal scrolling pill row and the sheet's full-width stacked rows (the mockup lays the sheet
  // out as a vertical list, not a horizontally-scrolled one).
  const renderTile = (tool: ScheduleTool, vertical: boolean) => {
    const key = toolKey(tool);
    const isActive = key === activeKey;
    return (
      <Box
        key={key}
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          width: vertical ? '100%' : undefined,
          borderRadius: vertical ? 2 : 1.5,
          border: isActive ? `1px solid ${theme.palette.primary.main}` : '1px solid #e0e0dc',
          backgroundColor: isActive ? theme.palette.accentSurface.subtle : 'transparent',
        })}
      >
        <Box
          component="button"
          type="button"
          aria-pressed={isActive}
          onClick={() => selectTool(tool)}
          sx={(theme) => ({
            display: 'flex',
            flex: vertical ? 1 : undefined,
            minWidth: 0,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            textAlign: 'left',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            font: 'inherit',
            color: 'inherit',
            px: 1.5,
            py: 0.75,
            minHeight: 44,
            borderRadius: vertical ? 2 : 1.5,
            // Otherwise the browser drags the label text instead of the tile.
            userSelect: 'none',
            '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
          })}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={500} noWrap>
              {toolLabel(tool, t)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {toolSummary(tool, t)}
            </Typography>
          </Box>
          {vertical && isActive && (
            <Chip
              size="small"
              label={t('activeChipLabel')}
              sx={(theme) => ({ bgcolor: theme.palette.primary.main, color: '#fff', flexShrink: 0 })}
            />
          )}
        </Box>

        {tool.kind === 'template' && (
          <IconButton
            size="small"
            aria-label={t('templateMenuAriaLabel', { name: tool.template.name })}
            onClick={(e: MouseEvent<HTMLElement>) => setMenuFor({ template: tool.template, anchor: e.currentTarget })}
            sx={{ mr: 0.5 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    );
  };

  // A plain (non-button) Box, deliberately: the X and "Fertig" below are already real <button>s, and
  // nesting an interactive element inside another <button> is invalid HTML - React warns
  // (validateDOMNesting) and real browsers handle the resulting click/focus behavior inconsistently.
  // Only the label in the middle is itself a button (when onOpenSheet is given, i.e. the mobile
  // sheet-reopen case) - it sits as a SIBLING of the X/Fertig, never their ancestor.
  const assignBanner = (onOpenSheet?: () => void) => (
    <Box
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: '100%',
        minHeight: 52,
        px: 1,
        backgroundColor: theme.palette.primary.main,
        color: '#ffffff',
      })}
    >
      <IconButton aria-label={t('finishAssigningAriaLabel')} onClick={onFinishAssigning} sx={{ color: '#ffffff', ml: -0.5 }}>
        <CloseIcon />
      </IconButton>
      <Box
        component={onOpenSheet ? 'button' : 'div'}
        type={onOpenSheet ? 'button' : undefined}
        onClick={onOpenSheet}
        sx={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          textAlign: 'left',
          py: 0.5,
          borderRadius: 1,
          cursor: onOpenSheet ? 'pointer' : 'default',
          '&:focus-visible': { outline: '2px solid #ffffff', outlineOffset: 2 },
        }}
      >
        <Typography variant="body2" fontWeight={500} noWrap>
          {t('assignBannerText', { tool: activeTool ? toolLabel(activeTool, t) : '' })}
        </Typography>
        <Typography variant="caption" noWrap display="block" sx={{ opacity: 0.85 }}>
          {t('tapDaysCaption')}
        </Typography>
      </Box>
      <Button
        onClick={onFinishAssigning}
        sx={{
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: 5,
          flexShrink: 0,
          '&:hover': { borderColor: '#ffffff', backgroundColor: 'rgba(255,255,255,0.08)' },
        }}
      >
        {t('doneButton')}
      </Button>
    </Box>
  );

  // Same shape as assignBanner (see the comment there on why the middle Box is a plain div unless
  // onOpenSheet is given) - a distinct function, not a parameterized variant, since the two modes
  // are mutually exclusive and never need to share one call site. Count is always plural ("N Zellen
  // ausgewählt", even at 1) matching this file's own "{templates.length} Vorlagen" precedent.
  const selectionBanner = (onOpenSheet?: () => void) => (
    <Box
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: '100%',
        minHeight: 52,
        px: 1,
        backgroundColor: theme.palette.primary.main,
        color: '#ffffff',
      })}
    >
      <IconButton aria-label={t('finishSelectingAriaLabel')} onClick={onFinishSelecting} sx={{ color: '#ffffff', ml: -0.5 }}>
        <CloseIcon />
      </IconButton>
      <Box
        component={onOpenSheet ? 'button' : 'div'}
        type={onOpenSheet ? 'button' : undefined}
        onClick={onOpenSheet}
        sx={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          textAlign: 'left',
          py: 0.5,
          borderRadius: 1,
          cursor: onOpenSheet ? 'pointer' : 'default',
          '&:focus-visible': { outline: '2px solid #ffffff', outlineOffset: 2 },
        }}
      >
        <Typography variant="body2" fontWeight={500} noWrap>
          {t('selectionBannerText', { selected: selectedCount })}
        </Typography>
        <Typography variant="caption" noWrap display="block" sx={{ opacity: 0.85 }}>
          {t('tapToolCaption')}
        </Typography>
      </Box>
      <Button
        onClick={onFinishSelecting}
        sx={{
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: 5,
          flexShrink: 0,
          '&:hover': { borderColor: '#ffffff', backgroundColor: 'rgba(255,255,255,0.08)' },
        }}
      >
        {t('doneButton')}
      </Button>
    </Box>
  );

  const selectionToggleButton = (
    <Button
      size="small"
      startIcon={<ChecklistOutlinedIcon />}
      aria-pressed={selectionModeActive}
      onClick={onToggleSelectionMode}
      variant={selectionModeActive ? 'contained' : 'text'}
      sx={{ flexShrink: 0 }}
    >
      {t('multiSelectButton')}
    </Button>
  );

  if (!collapsible) {
    // Tablet keeps the tile row visible even while assigning - unlike mobile's collapsed sheet
    // below, there is no other way to reach a different tile there, so hiding the row would mean
    // "Fertig" is the only way to switch tools mid-assignment.
    return (
      <>
        <Paper
          component="section"
          aria-label={t('toolbarAriaLabel')}
          sx={{
            position: 'sticky',
            top: 'var(--pep-header-height, 64px)',
            zIndex: 2,
            mb: 2,
            overflow: 'hidden',
            backgroundColor: 'background.paper',
          }}
        >
          {selectionModeActive ? (
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>{selectionBanner()}</Box>
          ) : (
            assignModeActive && <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>{assignBanner()}</Box>
          )}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1, overflowX: 'auto', pb: 0.5 }}>
            {tools.map((tool) => renderTile(tool, false))}
            <Button size="small" startIcon={<AddIcon />} onClick={onCreate} sx={{ flexShrink: 0 }}>
              {t('newTemplateButton')}
            </Button>
            {selectionToggleButton}
            {templates.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, pl: 1 }}>
                {t('noTemplatesCaption')}
              </Typography>
            )}
          </Stack>
        </Paper>
        {templateMenu}
      </>
    );
  }

  // Mobile: a collapsed "Vorlagen & Werkzeuge" bar (or the assign-mode banner in its place, both
  // still sticky under the header like the laptop/tablet Paper above) opens a bottom sheet holding
  // the tiles as a vertical list - the grid gets its width back instead of a horizontally-scrolled
  // strip of tiles too narrow to read.
  return (
    <>
      <Paper
        component="section"
        aria-label={tCommon('secondaryActions')}
        // Not sticky-from-top like the tablet/laptop Paper above: on mobile this is the LAST
        // flex-shrink:0 child of ScheduleView's bounded flex column (see AppShell's
        // fullBleedPage), placed directly above the fixed bottom tab bar by flex stacking alone -
        // matching the mockup exactly. mx cancels the wrapper's own horizontal padding so this
        // reaches the true edges; mb:0 since there is no trailing gap to the tab bar below it.
        sx={{ zIndex: 2, mb: 0, mx: -1.5, overflow: 'hidden' }}
      >
        {selectionModeActive ? (
          selectionBanner(() => setSheetOpen(true))
        ) : assignModeActive ? (
          assignBanner(() => setSheetOpen(true))
        ) : (
          <Box
            component="button"
            type="button"
            onClick={() => setSheetOpen(true)}
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              minHeight: 52,
              px: 2,
              border: 'none',
              background: 'transparent',
              font: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <Box sx={{ width: 36, height: 4, borderRadius: 1, backgroundColor: '#cfcfc9', flexShrink: 0 }} />
            <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
              {tCommon('secondaryActions')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('templatesCountCaption', { count: templates.length })}
            </Typography>
            <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </Box>
        )}
      </Paper>

      <SwipeableDrawer
        anchor="bottom"
        open={sheetOpen}
        onOpen={() => setSheetOpen(true)}
        onClose={() => setSheetOpen(false)}
        disableSwipeToOpen
        // Never covers more than 60% of the screen, per the mockup's explicit requirement - the
        // content inside scrolls instead of the sheet growing past it (flex column, only the inner
        // Box below scrolls, the drag handle stays put at the top).
        slotProps={{ paper: { sx: { maxHeight: ['60vh', '60dvh'], display: 'flex', flexDirection: 'column' } } }}
      >
        {/* A modal overlay (MUI Drawer z-index 1200), above BottomTabBar's 1100 - only needs the
            device's own bottom safe-area inset, not MOBILE_TAB_BAR_HEIGHT (that's for content that
            must clear the tab bar's height, which an overlay drawn on top of it doesn't). */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1, pb: 1, flexShrink: 0 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 1, backgroundColor: '#cfcfc9' }} />
        </Box>
        <Box sx={{ overflowY: 'auto', flex: 1, pb: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
          <Typography variant="subtitle1" fontWeight={500} sx={{ px: 2, pb: 1 }}>
            {tCommon('secondaryActions')}
          </Typography>

          <Typography variant="overline" color="text.secondary" sx={{ px: 2, display: 'block' }}>
            {tCommon('columnActions')}
          </Typography>
          <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<SwapHorizOutlinedIcon />}
              onClick={() => {
                setSheetOpen(false);
                onCarryOver();
              }}
            >
              {t('carryOverButton')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ContentCopyOutlinedIcon />}
              onClick={() => {
                setSheetOpen(false);
                onCopyPreviousWeek();
              }}
            >
              {t('copyPreviousWeekButton')}
            </Button>
            {printAvailable && (
              <Button
                variant="outlined"
                startIcon={<PrintOutlinedIcon />}
                onClick={() => {
                  setSheetOpen(false);
                  onPrint();
                }}
              >
                {t('printViewButton')}
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<ChecklistOutlinedIcon />}
              aria-pressed={selectionModeActive}
              onClick={() => {
                setSheetOpen(false);
                onToggleSelectionMode();
              }}
            >
              {t('multiSelectButton')}
            </Button>
          </Stack>

          <Divider />
          <Typography variant="overline" color="text.secondary" sx={{ px: 2, pt: 2, display: 'block' }}>
            {t('planningOverline')}
          </Typography>
          <Box sx={{ px: 2, pb: 1 }}>{headerFields}</Box>

          <Divider />
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 2, pb: 1 }}>
            <Typography variant="overline" color="text.secondary">
              {t('templatesOverline')}
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => {
                setSheetOpen(false);
                onCreate();
              }}
            >
              {t('newButton')}
            </Button>
          </Stack>
          <Stack spacing={1} sx={{ px: 2 }}>
            {tools.map((tool) => renderTile(tool, true))}
            {templates.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('noTemplatesCaption')}
              </Typography>
            )}
          </Stack>
        </Box>
      </SwipeableDrawer>

      {templateMenu}
    </>
  );
}
