import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@vd/theme/theme.css';
import { initTheme } from '@vd/theme';
import { App } from './app';

initTheme();

registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event('vd:sw-update'));
  },
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
