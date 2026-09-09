import type { SvgIconComponent } from '@mui/icons-material';

/**
 * One secondary action on a list row (edit, deactivate, delete...), described once and rendered
 * two ways depending on breakpoint: as an entry in RowActionSheet (mobile long-press, tablet "⋮"),
 * or - at the laptop breakpoint, where this type isn't used at all - as today's inline hover
 * IconButton, which each view keeps writing by hand since it's unchanged there.
 */
export interface RowAction {
  key: string;
  label: string;
  icon: SvgIconComponent;
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
  dangerous?: boolean;
}
