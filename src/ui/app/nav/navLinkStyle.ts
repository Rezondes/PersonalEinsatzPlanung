/**
 * The class exists only so theme.ts can give these links a :active state. The global
 * -webkit-tap-highlight-color: transparent removes the browser's own touch feedback, and these are
 * bare anchors without MUI's ripple - without a replacement, tapping a nav entry gives no feedback
 * at all until the route swaps. Inline styles cannot carry a pseudo-class, hence a class.
 *
 * Used by NavRail's own bare NavLinks (see NavRail.tsx's own comment on its className usage) -
 * BottomTabBar's real MUI BottomNavigationAction already ships its own press feedback and needs
 * none of this.
 */
export const NAV_LINK_CLASS = 'pep-nav-link';
