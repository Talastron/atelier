import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Mobile viewport fix: pin --app-vh to the actual visible pixel height so
// position:fixed bottom-anchored elements (bottom nav) sit above iOS Safari's
// address bar, not behind it. dvh handles most cases; this is a hard guarantee.
function syncAppVh() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-vh', `${h}px`);
}
syncAppVh();
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncAppVh);
  window.visualViewport.addEventListener('scroll', syncAppVh);
} else {
  window.addEventListener('resize', syncAppVh);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
