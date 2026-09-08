/**
 * The one list of places where text may be selected AND the browser's own context menu may open.
 *
 * Those two are the same question ("is this text the user is allowed to do something with?"), so
 * they share one constant rather than two lists that drift. Two consumers:
 *   - theme.ts, which re-enables user-select and the iOS touch callout for these elements
 *   - hooks/useSuppressBrowserContextMenu.ts, which lets right-click through for them
 *
 * Everything else in the app is unselectable and has no context menu, so it reads as an
 * application rather than a web page.
 *
 * Why each entry is here:
 * - input / textarea / select / [contenteditable]: not a nicety. On iOS Safari a
 *   -webkit-user-select: none on an ancestor makes fields not just unselectable but UNTYPEABLE,
 *   and suppressing right-click there would remove paste-by-mouse and the long-press paste bubble.
 * - [role="alert"]: every error and notice in the app, in one semantic rule. MUI's Alert carries
 *   that role by default, and so does the hand-rolled components/FormErrorNotice.tsx, so this
 *   covers schedule validation, import errors, Drive failures and ArbZG warnings alike. Someone
 *   who wants to report a problem must be able to copy what it said. .MuiAlert-root rides along
 *   in case an Alert is ever given a different role.
 * - [data-selectable]: the manual opt-in for prose that is not an Alert - the privacy notice, the
 *   version block on Einstellungen, confirmation dialog texts, the print view.
 */
export const SELECTABLE_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], ' +
  '[role="alert"], .MuiAlert-root, [data-selectable]';
