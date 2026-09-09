import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';

export interface FabAction {
  label: string;
  /** A component reference, not a rendered element - MobileFab renders `<icon />` itself, so an
   * inline `<AddIcon />` at the call site doesn't create a new element identity every render. */
  icon: SvgIconComponent;
  onClick: () => void;
}

export interface PageActions {
  fab?: FabAction;
  /** True while the current view wants AppShell's mobile Container to become a zero-padding,
   * bounded flex-column (fill exactly between the header and the fixed bottom tab bar) instead of
   * the normal padded, page-scrolling layout every other mobile page uses - e.g. because it hosts
   * its own scrolling region that must stay bounded between two fixed chrome pieces. Only Woche
   * needs this today. Ignored outside the mobile breakpoint. */
  fullBleedMobile?: boolean;
}

interface PageActionsContextValue {
  actions: PageActions;
  setActions: (actions: PageActions) => void;
}

const PageActionsContext = createContext<PageActionsContextValue | null>(null);

/** Mounted once by AppShell, above the router Outlet. */
export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<PageActions>({});
  return <PageActionsContext.Provider value={{ actions, setActions }}>{children}</PageActionsContext.Provider>;
}

/**
 * Called by a view to register its primary mobile action (rendered as MobileFab). Registers on
 * mount and whenever the label/icon/handler change, clears on unmount - so navigating away always
 * drops a stale action and AppShell never has to know which route owns which action (no
 * `switch (location.pathname)`). A view that wants no FAB (Woche, Monat, Mehr) simply never calls
 * this.
 */
export function usePageActions(actions: PageActions): void {
  const ctx = useContext(PageActionsContext);
  const setActions = ctx?.setActions;
  const { fab, fullBleedMobile } = actions;
  // Re-registers whenever the caller passes a new label/icon/handler, not on every render of the
  // host view - onClick is typically a fresh closure per render, so keying only on label+icon
  // (which are stable in practice: a page's create-action wording doesn't change while mounted)
  // avoids the churn of clearing and re-setting the Fab on every keystroke in a page above it.
  const onClickRef = useRef(fab?.onClick);
  onClickRef.current = fab?.onClick;

  useEffect(() => {
    if (!setActions) return;
    if (!fab && !fullBleedMobile) {
      setActions({});
      return;
    }
    const stableFab: FabAction | undefined = fab
      ? { label: fab.label, icon: fab.icon, onClick: () => onClickRef.current?.() }
      : undefined;
    setActions({ fab: stableFab, fullBleedMobile });
    return () => setActions({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on label/icon/fullBleedMobile by design, see above
  }, [setActions, fab?.label, fab?.icon, fullBleedMobile]);
}

/** Read by MobileFab only. */
export function usePageActionsValue(): PageActions {
  const ctx = useContext(PageActionsContext);
  return ctx?.actions ?? {};
}
