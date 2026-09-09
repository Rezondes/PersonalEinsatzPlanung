import { useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { ScheduleTool } from '../scheduleTools';
import { OFF_TOOL, TOOL_MIME, toolKey, toolLabel, toolSummary } from '../scheduleTools';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';

interface ScheduleToolbarProps {
  templates: ShiftTemplate[];
  activeTool: ScheduleTool | null;
  onSelect: (tool: ScheduleTool) => void;
  /** Hands the dragged tool to the parent (which holds it in a ref) and clears it again on drop or
   * abort - dataTransfer cannot carry it, since its data is unreadable while dragging over a cell.
   * Only ever called at the laptop breakpoint - see the `draggable` gate on the tile itself. */
  onDragTool: (tool: ScheduleTool | null) => void;
  onCreate: () => void;
  onEdit: (template: ShiftTemplate) => void;
  onDelete: (template: ShiftTemplate) => void;
  /** Touch-only: true once a tile tap has armed tap-to-assign (see ScheduleView.selectTool). Never
   * true at the laptop breakpoint, where a tile click only arms drag-and-drop/"Einfügen" as before. */
  assignModeActive: boolean;
  /** Clears assignModeActive AND the active tool - the banner's X and its "Fertig" button both call
   * this, matching the mockup's "Zuweisen beenden" affordance. */
  onFinishAssigning: () => void;
}

/**
 * The tool palette above the weekly grid. At the laptop breakpoint this is unchanged from before
 * the responsive redesign: a sticky horizontal row, tiles are draggable, a click only arms
 * "Einfügen"/paste. Below laptop every tile tap ALSO arms tap-to-assign (ScheduleView sets
 * assignModeActive), and the row is replaced by a green "Zuweisen-Modus" banner while that is
 * active - matching PEP Responsive.dc.html's Handy "Vorlagen-Sheet, Zuweisen-Modus" screen.
 *
 * Chrome differs only at the narrowest class: both tablet widths keep the same horizontal row as
 * laptop (compare the mockup's 4c/4d tablet renders, which never collapse it), tapping a tile there
 * both arms the tool and starts assigning. Only mobile collapses the row into a "Vorlagen &
 * Werkzeuge" bar that opens a bottom sheet - the mockup does this only for the 390px Handy class,
 * never for tablet.
 */
export function ScheduleToolbar({
  templates,
  activeTool,
  onSelect,
  onDragTool,
  onCreate,
  onEdit,
  onDelete,
  assignModeActive,
  onFinishAssigning,
}: ScheduleToolbarProps) {
  const layout = useBreakpoint();
  const touchMode = layout !== 'laptop';
  const collapsible = layout === 'mobile';
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<{ template: ShiftTemplate; anchor: HTMLElement } | null>(null);

  const clipboardTool = activeTool?.kind === 'clipboard' ? activeTool : null;
  const tools: ScheduleTool[] = [
    OFF_TOOL,
    ...(clipboardTool ? [clipboardTool] : []),
    ...templates.map((template): ScheduleTool => ({ kind: 'template', template })),
  ];
  const activeKey = activeTool ? toolKey(activeTool) : null;

  const selectTool = (tool: ScheduleTool) => {
    onSelect(tool);
    // The sheet is only ever how a touch user REACHES a tile - once armed there is nothing left to
    // do inside it. Reopening it (tapping the banner) is how they switch tools mid-assignment.
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
        Bearbeiten
      </MenuItem>
      <MenuItem
        onClick={() => {
          if (menuFor) onDelete(menuFor.template);
          setMenuFor(null);
        }}
      >
        Löschen
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
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          width: vertical ? '100%' : undefined,
          borderRadius: vertical ? 2 : 1.5,
          border: isActive ? '1px solid #2f5d50' : '1px solid #e0e0dc',
          backgroundColor: isActive ? '#eef3f1' : 'transparent',
        }}
      >
        <Box
          component="button"
          type="button"
          draggable={!touchMode}
          aria-pressed={isActive}
          onClick={() => selectTool(tool)}
          onDragStart={
            touchMode
              ? undefined
              : (e: DragEvent) => {
                  // Firefox refuses to start a drag without setData. The value is only a marker:
                  // the real payload goes to the parent via onDragTool.
                  e.dataTransfer.setData(TOOL_MIME, key);
                  e.dataTransfer.effectAllowed = 'copy';
                  onDragTool(tool);
                }
          }
          onDragEnd={touchMode ? undefined : () => onDragTool(null)}
          sx={{
            display: 'flex',
            flex: vertical ? 1 : undefined,
            minWidth: 0,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            textAlign: 'left',
            cursor: touchMode ? 'pointer' : 'grab',
            border: 'none',
            background: 'transparent',
            font: 'inherit',
            color: 'inherit',
            px: 1.5,
            py: 0.75,
            minHeight: touchMode ? 44 : undefined,
            borderRadius: vertical ? 2 : 1.5,
            // Otherwise the browser drags the label text instead of the tile.
            userSelect: 'none',
            '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: 2 },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={500} noWrap>
              {toolLabel(tool)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {toolSummary(tool)}
            </Typography>
          </Box>
          {vertical && isActive && <Chip size="small" label="aktiv" sx={{ bgcolor: '#2f5d50', color: '#fff', flexShrink: 0 }} />}
        </Box>

        {tool.kind === 'template' && (
          <IconButton
            size="small"
            aria-label={`${tool.template.name} bearbeiten oder löschen`}
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
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: '100%',
        minHeight: 52,
        px: 1,
        backgroundColor: '#2f5d50',
        color: '#ffffff',
      }}
    >
      <IconButton aria-label="Zuweisen beenden" onClick={onFinishAssigning} sx={{ color: '#ffffff', ml: -0.5 }}>
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
          {activeTool ? toolLabel(activeTool) : ''} zuweisen
        </Typography>
        <Typography variant="caption" noWrap display="block" sx={{ opacity: 0.85 }}>
          Tage antippen
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
        Fertig
      </Button>
    </Box>
  );

  if (!collapsible) {
    // Laptop (touchMode is always false there, so the banner Box below never renders - the Paper's
    // only child stays the exact same Stack as before this phase) and both tablet widths (same
    // chrome, tap-to-assign instead of/alongside drag) share this branch. Tablet has the width to
    // keep the tile row visible even while assigning - unlike mobile's collapsed sheet below, there
    // is no other way to reach a different tile there, so hiding the row would mean "Fertig" is the
    // only way to switch tools mid-assignment.
    return (
      <Paper
        component="section"
        aria-label="Werkzeugleiste"
        sx={{
          position: 'sticky',
          top: 'var(--pep-header-height, 64px)',
          zIndex: 2,
          mb: 2,
          overflow: 'hidden',
          backgroundColor: 'background.paper',
        }}
      >
        {touchMode && assignModeActive && <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>{assignBanner()}</Box>}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1, overflowX: 'auto', pb: 0.5 }}>
          {tools.map((tool) => renderTile(tool, false))}
          <Button size="small" startIcon={<AddIcon />} onClick={onCreate} sx={{ flexShrink: 0 }}>
            Vorlage
          </Button>
          {templates.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, pl: 1 }}>
              Eigene Schichten anlegen, dann auf einen Tag ziehen.
            </Typography>
          )}
        </Stack>
      </Paper>
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
        aria-label="Werkzeugleiste"
        sx={{ position: 'sticky', top: 'var(--pep-header-height, 64px)', zIndex: 2, mb: 2, overflow: 'hidden' }}
      >
        {assignModeActive ? (
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
              Vorlagen &amp; Werkzeuge
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {templates.length} Vorlagen
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
      >
        <Box sx={{ pt: 1, pb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
            <Box sx={{ width: 36, height: 4, borderRadius: 1, backgroundColor: '#cfcfc9' }} />
          </Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pb: 1 }}>
            <Typography variant="subtitle1" fontWeight={500}>
              Vorlagen &amp; Werkzeuge
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => {
                setSheetOpen(false);
                onCreate();
              }}
            >
              Neu
            </Button>
          </Stack>
          <Stack spacing={1} sx={{ px: 2 }}>
            {tools.map((tool) => renderTile(tool, true))}
            {templates.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                Eigene Schichten anlegen, dann auf einen Tag tippen.
              </Typography>
            )}
          </Stack>
        </Box>
      </SwipeableDrawer>

      {templateMenu}
    </>
  );
}
