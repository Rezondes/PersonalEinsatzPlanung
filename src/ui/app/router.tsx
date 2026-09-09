import { createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ScheduleView } from '@ui/views/schedule/ScheduleView';
import { MonthOverviewView } from '@ui/views/month/MonthOverviewView';
import { BranchMasterDataView } from '@ui/views/masterdata/BranchMasterDataView';
import { EmployeeMasterDataView } from '@ui/views/masterdata/EmployeeMasterDataView';
import { AbsencesView } from '@ui/views/absences/AbsencesView';
import { PrintPreviewView } from '@ui/views/print/PrintPreviewView';
import { SettingsView } from '@ui/views/settings/SettingsView';
import { PrivacyView } from '@ui/views/settings/PrivacyView';
import { MorePage } from './nav/MorePage';

export const router = createHashRouter([
  {
    path: '/print/:scheduleId',
    element: <PrintPreviewView />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/schedule" replace /> },
      { path: 'schedule', element: <ScheduleView /> },
      { path: 'month', element: <MonthOverviewView /> },
      { path: 'branches', element: <BranchMasterDataView /> },
      { path: 'employees', element: <EmployeeMasterDataView /> },
      { path: 'absences', element: <AbsencesView /> },
      { path: 'settings', element: <SettingsView /> },
      { path: 'privacy', element: <PrivacyView /> },
      { path: 'more', element: <MorePage /> },
    ],
  },
]);
