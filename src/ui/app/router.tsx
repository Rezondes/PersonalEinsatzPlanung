import { createHashRouter, Navigate, redirect } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ScheduleView } from '@ui/views/schedule/ScheduleView';
import { MonthOverviewView } from '@ui/views/month/MonthOverviewView';
import { BranchMasterDataView } from '@ui/views/masterdata/BranchMasterDataView';
import { EmployeeMasterDataView } from '@ui/views/masterdata/EmployeeMasterDataView';
import { AbsencesView } from '@ui/views/absences/AbsencesView';
import { PrintPreviewView } from '@ui/views/print/PrintPreviewView';
import { SettingsView } from '@ui/views/settings/SettingsView';
import { PrivacyView } from '@ui/views/settings/PrivacyView';
import { TermsView } from '@ui/views/settings/TermsView';
import { ChangelogView } from '@ui/views/changelog/ChangelogView';
import { MorePage } from './nav/MorePage';
import { DEFAULT_LOCALE } from './locale/locale';
import { localeLoader } from './locale/localeLoader';
import { LocaleRoot } from './locale/LocaleRoot';

// Exported separately from `router` so router.test.tsx can drive it with react-router's own
// createMemoryRouter instead of a real hash history.
export const routes: RouteObject[] = [
  // No `:locale` segment to match at the bare hash root, so this needs its own sibling redirect
  // rather than falling through to the loader below.
  { path: '/', loader: () => redirect(`/${DEFAULT_LOCALE}`) },
  {
    path: '/:locale',
    loader: localeLoader,
    element: <LocaleRoot />,
    children: [
      { path: 'print/:scheduleId', element: <PrintPreviewView /> },
      {
        path: '',
        element: <AppShell />,
        children: [
          // Relative target: resolves under whichever locale is currently matched.
          { index: true, element: <Navigate to="schedule" replace /> },
          { path: 'schedule', element: <ScheduleView /> },
          { path: 'month', element: <MonthOverviewView /> },
          { path: 'branches', element: <BranchMasterDataView /> },
          { path: 'employees', element: <EmployeeMasterDataView /> },
          { path: 'absences', element: <AbsencesView /> },
          { path: 'settings', element: <SettingsView /> },
          { path: 'changelog', element: <ChangelogView /> },
          { path: 'privacy', element: <PrivacyView /> },
          { path: 'terms', element: <TermsView /> },
          { path: 'more', element: <MorePage /> },
        ],
      },
    ],
  },
];

export const router = createHashRouter(routes);
