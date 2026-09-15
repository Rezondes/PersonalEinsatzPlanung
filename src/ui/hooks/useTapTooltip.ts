import { useState } from 'react';
import { useBreakpoint } from './useBreakpoint';

/**
 * Shared "tap-to-show on mobile, hover-still-works from tablet width up, tap-elsewhere-to-dismiss"
 * MUI Tooltip controller. One `openKey` at a time, keyed by whatever string each call site chooses
 * (e.g. a cell/row id) - opening a new key always closes whichever was open.
 *
 * `disableHoverListener` follows this codebase's one established touch-vs-desktop idiom
 * (`useBreakpoint() === 'mobile'`, see AppHeader.tsx/ScheduleToolbar.tsx) rather than a CSS
 * hover-media-query - `useBreakpoint()`'s 'tablet' bucket already covers real desktop/laptop
 * widths, so hover is enabled everywhere except actual phone widths.
 *
 * Click-away dismissal is NOT handled here - MUI's Tooltip does not add any click/pointerdown
 * document listener of its own even when controlled (verified against its installed source), so
 * every consumer must wrap its trigger in `<ClickAwayListener onClickAway={() => close(key)}>`
 * itself. `close` takes the SAME key the tooltip was opened with (not a bare no-arg close): when
 * several tooltips share one instance of this hook (e.g. one per table row/cell), each one's own
 * ClickAwayListener fires on every click that lands outside ITS OWN subtree - including a click on
 * a DIFFERENT tooltip's trigger, which just opened THAT one. An unconditional close() there would
 * immediately null out the key the other trigger's own onClick just set, so a tap could never
 * actually open anything whenever more than one tooltip was mounted at once. Keying close() to the
 * same key only clears state when THAT tooltip is the one actually open, so it's a no-op for every
 * ClickAwayListener except the one guarding whichever tooltip is genuinely open.
 */
export function useTapTooltip() {
  const layout = useBreakpoint();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const toggle = (key: string) => setOpenKey((prev) => (prev === key ? null : key));
  const close = (key: string) => setOpenKey((prev) => (prev === key ? null : prev));

  const tooltipProps = (key: string) => ({
    open: openKey === key,
    onOpen: () => setOpenKey(key),
    onClose: () => close(key),
    disableFocusListener: true,
    disableHoverListener: layout === 'mobile',
    disableTouchListener: true,
  });

  return { layout, openKey, toggle, close, tooltipProps };
}
