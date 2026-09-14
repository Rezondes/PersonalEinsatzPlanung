import type { SvgIconComponent } from '@mui/icons-material';
import type { NavKey } from '@ui/i18n/resources/de/nav';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import CalendarViewMonthOutlinedIcon from '@mui/icons-material/CalendarViewMonthOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import MoreHorizOutlinedIcon from '@mui/icons-material/MoreHorizOutlined';

export interface NavItem {
  path: string;
  /** Translation key in the `nav` i18n namespace, not a finished string - consumers call
   * t(item.label). Full label, used by NavRail. */
  label: NavKey;
  /** Translation key for the mobile bottom tab bar's tight width; falls back to `label`. */
  shortLabel?: NavKey;
  icon: SvgIconComponent;
}

/**
 * The five primary destinations, shown on NavRail (mobile uses BOTTOM_TABS instead). Order
 * matches the mockup's `railMain`.
 */
export const MAIN_NAV_ITEMS: NavItem[] = [
  { path: '/schedule', label: 'schedule', shortLabel: 'scheduleShort', icon: EventNoteOutlinedIcon },
  { path: '/month', label: 'month', shortLabel: 'monthShort', icon: CalendarViewMonthOutlinedIcon },
  { path: '/employees', label: 'employees', shortLabel: 'employeesShort', icon: GroupOutlinedIcon },
  { path: '/absences', label: 'absences', shortLabel: 'absencesShort', icon: EventBusyOutlinedIcon },
  { path: '/branches', label: 'branches', icon: StoreOutlinedIcon },
];

/** Secondary destinations, shown in a footer section on NavRail. */
export const FOOTER_NAV_ITEMS: NavItem[] = [
  { path: '/changelog', label: 'changelog', icon: HistoryOutlinedIcon },
  { path: '/privacy', label: 'privacy', icon: ShieldOutlinedIcon },
  { path: '/terms', label: 'terms', icon: GavelOutlinedIcon },
  { path: '/settings', label: 'settings', icon: SettingsOutlinedIcon },
];

export interface BottomTab extends NavItem {
  /** Paths beyond `path` itself that should also show this tab as active - only the "Mehr" tab
   * uses this, since /branches, /settings and /privacy are all reached through it. */
  matchPaths?: string[];
}

/** The mobile bottom tab bar: the first four MAIN_NAV_ITEMS (by their short label) plus a "Mehr"
 * tab that aggregates Filialen, Einstellungen, Datenschutz and Nutzungsbedingungen - there is no
 * room for all five main items plus the footer items in a five-tab bar. Mirrors the mockup's own
 * separate `TAB_DEFS` list (distinct from `railMain`), not a filtered view of MAIN_NAV_ITEMS. */
export const BOTTOM_TABS: BottomTab[] = [
  MAIN_NAV_ITEMS[0],
  MAIN_NAV_ITEMS[1],
  MAIN_NAV_ITEMS[2],
  MAIN_NAV_ITEMS[3],
  {
    path: '/more',
    label: 'more',
    icon: MoreHorizOutlinedIcon,
    matchPaths: ['/more', '/branches', '/settings', '/privacy', '/terms', '/changelog'],
  },
];
