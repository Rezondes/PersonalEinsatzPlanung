import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@ui/app/App';
// Vor App, damit die Schrift zusammen mit dem ersten Rendern steht statt danach nachzuspringen.
import '@ui/app/inter.css';
// Vor App, damit i18next mit den deutschen Ressourcen fertig initialisiert ist, bevor die erste
// Komponente t()/useTranslation() aufruft - sonst blitzen rohe Keys auf oder eine
// uninitialisierte Instanz wirft.
import '@ui/i18n/i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
