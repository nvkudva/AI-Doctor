import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import './lib/theme/theme.css';
import { initTheme } from './lib/theme';
import { App } from './shell/App';

initTheme();

// registerSW returns the only function that can promote a waiting worker:
// it posts SKIP_WAITING and reloads once the new worker has taken control.
// AppShell's toast used to call location.reload(), which re-runs the OLD
// worker's cached shell — the new build then sat waiting until every tab for
// this origin was closed, so a deploy was effectively never picked up.
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('vd:sw-update', { detail: updateSW }));
  },
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
