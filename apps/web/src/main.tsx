import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import './lib/theme/theme.css';
import { initTheme } from './lib/theme';
import { App } from './App';

initTheme();

registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event('vd:sw-update'));
  },
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
