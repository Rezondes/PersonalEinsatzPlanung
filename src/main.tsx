import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@ui/app/App';
// Vor App, damit die Schrift zusammen mit dem ersten Rendern steht statt danach nachzuspringen.
import '@ui/app/inter.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
