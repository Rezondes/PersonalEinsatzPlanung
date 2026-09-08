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
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { ShiftTemplate } from '@domain/schedule/ShiftTemplate';
import type { ScheduleTool } from '../scheduleTools';
import { OFF_TOOL, TOOL_MIME, toolKey, toolLabel, toolSummary } from '../scheduleTools';

interface ScheduleToolbarProps {
  templates: ShiftTemplate[];
  activeTool: ScheduleTool | null;
  onSelect: (tool: ScheduleTool) => void;
  /** Hands the dragged tool to the parent (which holds it in a ref) and clears it again on drop or
   * abort - dataTransfer cannot carry it, since its data is unreadable while dragging over a cell. */
  onDragTool: (tool: ScheduleTool | null) => void;
  onCreate: () => void;
  onEdit: (template: ShiftTemplate) => void;
  onDelete: (template: ShiftTemplate) => void;
}

/**
 * The always-visible tool palette above the weekly grid: the fixed "Frei" tile, whatever is
 * currently on the clipboard, and the branch's own shift templates. A tile can be clicked (it
 * becomes the active tool, which "Einfügen" in the cell menu then applies) or dragged onto a day.
 *
 * Sticks below the app header, whose height varies because its toolbar wraps - AppShell measures it
 * into the --pep-header-height custom property. The z-index stays low on purpose: ValidationNotices
 * renders its expanded panel at z-index 10 right across this area, and it has to stay on top.
 */
export function ScheduleToolbar({
  templates,
  activeTool,
  onSelect,
  onDragTool,
  onCreate,
  onEdit,
  onDelete,
}: ScheduleToolbarProps) {
  const [menuFor, setMenuFor] = useState<{ template: ShiftTemplate; anchor: HTMLElement } | null>(null);

  const clipboardTool = activeTool?.kind === 'clipboard' ? activeTool : null;
  const tools: ScheduleTool[] = [
    OFF_TOOL,
    ...(clipboardTool ? [clipboardTool] : []),
    ...templates.map((template): ScheduleTool => ({ kind: 'template', template })),
  ];

  const activeKey = activeTool ? toolKey(activeTool) : null;

  return (
    <Paper
      component="section"
      aria-label="Werkzeugleiste"
      sx={{
        position: 'sticky',
        top: 'var(--pep-header-height, 64px)',
        zIndex: 2,
        p: 1,
        mb: 2,
        backgroundColor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: 'auto', pb: 0.5 }}>
        {tools.map((tool) => {
          const key = toolKey(tool);
          const isActive = key === activeKey;
          return (
            <Box
              key={key}
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                borderRadius: 1.5,
                border: isActive ? '1px solid #2f5d50' : '1px solid #e0e0dc',
                backgroundColor: isActive ? '#eef3f1' : 'transparent',
              }}
            >
              <Box
                component="button"
                type="button"
                draggable
                aria-pressed={isActive}
                onClick={() => onSelect(tool)}
                onDragStart={(e: DragEvent) => {
                  // Firefox refuses to start a drag without setData. The value is only a marker:
                  // the real payload goes to the parent via onDragTool.
                  e.dataTransfer.setData(TOOL_MIME, key);
                  e.dataTransfer.effectAllowed = 'copy';
                  onDragTool(tool);
                }}
                onDragEnd={() => onDragTool(null)}
                sx={{
                  display: 'block',
                  textAlign: 'left',
                  cursor: 'grab',
                  border: 'none',
                  background: 'transparent',
                  font: 'inherit',
                  color: 'inherit',
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1.5,
                  // Otherwise the browser drags the label text instead of the tile.
                  userSelect: 'none',
                  '&:focus-visible': { outline: '2px solid #2f5d50', outlineOffset: 2 },
                }}
              >
                <Typography variant="body2" fontWeight={500} noWrap>
                  {toolLabel(tool)}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {toolSummary(tool)}
                </Typography>
              </Box>

              {tool.kind === 'template' && (
                <IconButton
                  size="small"
                  aria-label={`${tool.template.name} bearbeiten oder löschen`}
                  onClick={(e: MouseEvent<HTMLElement>) =>
                    setMenuFor({ template: tool.template, anchor: e.currentTarget })
                  }
                  sx={{ mr: 0.5 }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          );
        })}

        <Button size="small" startIcon={<AddIcon />} onClick={onCreate} sx={{ flexShrink: 0 }}>
          Vorlage
        </Button>

        {templates.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, pl: 1 }}>
            Eigene Schichten anlegen, dann auf einen Tag ziehen.
          </Typography>
        )}
      </Stack>

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
    </Paper>
  );
}
