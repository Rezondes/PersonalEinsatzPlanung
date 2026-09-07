import { createHashRouter, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { WochenplanView } from '@ui/views/wochenplanung/WochenplanView';
import { MonatsUebersichtView } from '@ui/views/monatsuebersicht/MonatsUebersichtView';
import { FilialeStammdatenView } from '@ui/views/stammdaten/FilialeStammdatenView';
import { MitarbeiterStammdatenView } from '@ui/views/stammdaten/MitarbeiterStammdatenView';
import { AbwesenheitenView } from '@ui/views/abwesenheiten/AbwesenheitenView';
import { DruckvorschauView } from '@ui/views/export/DruckvorschauView';
import { EinstellungenView } from '@ui/views/einstellungen/EinstellungenView';
import { DatenschutzView } from '@ui/views/einstellungen/DatenschutzView';

export const router = createHashRouter([
  {
    path: '/druck/:wochenplanId',
    element: <DruckvorschauView />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/wochenplan" replace /> },
      { path: 'wochenplan', element: <WochenplanView /> },
      { path: 'monat', element: <MonatsUebersichtView /> },
      { path: 'filialen', element: <FilialeStammdatenView /> },
      { path: 'mitarbeiter', element: <MitarbeiterStammdatenView /> },
      { path: 'abwesenheiten', element: <AbwesenheitenView /> },
      { path: 'einstellungen', element: <EinstellungenView /> },
      { path: 'datenschutz', element: <DatenschutzView /> },
    ],
  },
]);
