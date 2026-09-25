/** Hidden on screen, still read by screen readers (the usual clip pattern; @mui/utils'
 * visuallyHidden is not a direct dependency). Width/height as px strings: in `sx` a bare 1 = 100%. */
export const VISUALLY_HIDDEN_SX = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
