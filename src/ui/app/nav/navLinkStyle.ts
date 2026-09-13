/**
 * The class exists only so theme.ts can give these links a :active state. The global
 * -webkit-tap-highlight-color: transparent removes the browser's own touch feedback, and these are
 * bare anchors without MUI's ripple - without a replacement, tapping a nav entry gives no feedback
 * at all until the route swaps. Inline styles cannot carry a pseudo-class, hence a class.
 *
 * Used by LaptopNav's bare pill NavLinks AND by NavRail's own bare NavLinks (see NavRail.tsx's own
 * comment on its className usage) for the same reason - only BottomTabBar's real MUI
 * BottomNavigationAction already ships its own press feedback and needs none of this.
 */
export const NAV_LINK_CLASS = 'pep-nav-link';

export const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  color: isActive ? '#2f5d50' : '#4b4b47',
  fontWeight: isActive ? 500 : 400,
  textDecoration: 'none',
  fontSize: 14,
  padding: '6px 10px',
  borderRadius: 8,
  // undefined, not 'transparent': an inline background-color - even 'transparent' - always beats
  // a class-based CSS rule for the same property, which would silently defeat the
  // .pep-nav-link:active rule above (press feedback would never actually show, since it was always
  // overridden by this inline declaration) for every inactive link, i.e. always except the one
  // page currently open.
  backgroundColor: isActive ? '#eef3f1' : undefined,
});
