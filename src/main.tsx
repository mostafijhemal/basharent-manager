import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register offline service worker for Android Chrome PWA installability (HTTP/HTTPS only)
if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  (window.location.protocol === 'https:' || window.location.protocol === 'http:')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Ignore service worker registration errors in dev preview
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);

