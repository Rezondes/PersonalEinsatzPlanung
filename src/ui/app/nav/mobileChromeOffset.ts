/** MUI BottomNavigation's default height, which is what BottomTabBar renders at. Anything that
 * would otherwise sit underneath it on mobile - MobileFab, and the app-level overlays
 * (AppNotifications, UpdatePrompt, BuildVersionBadge) that predate the tab bar and default to
 * `bottom: 0`-ish positioning - needs to add this (plus the device safe area) to its own offset. */
export const MOBILE_TAB_BAR_HEIGHT = 56;

/** `extra` is additional breathing room above the tab bar, in px. */
export function mobileSafeBottom(extra = 0): string {
  return `calc(${MOBILE_TAB_BAR_HEIGHT + extra}px + env(safe-area-inset-bottom, 0px))`;
}
