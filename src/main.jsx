import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

// Global uncaught error listener to prevent silent white screen on mobile WebView
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('Global window error caught:', event.error || event.message);
    const rootEl = document.getElementById('root');
    if (rootEl && !rootEl.hasChildNodes()) {
      rootEl.innerHTML = `
        <div style="min-height:100vh;background:#090d16;color:#f8fafc;padding:24px;font-family:sans-serif;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">
          <div style="max-width:480px;background:#131b2e;padding:24px;border-radius:16px;border:1px solid #ef4444;">
            <div style="color:#ef4444;font-weight:bold;margin-bottom:8px;">NutriTrack Initialization Warning</div>
            <div style="font-size:14px;color:#94a3b8;margin-bottom:12px;">A script error occurred during page load:</div>
            <pre style="background:#060911;color:#fca5a5;padding:12px;border-radius:8px;font-size:12px;overflow:auto;max-height:120px;">${event.message || 'Script error'}</pre>
            <button onclick="window.location.reload()" style="margin-top:16px;width:100%;padding:12px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Reload App</button>
          </div>
        </div>
      `;
    }
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error("Fatal: 'root' element not found in DOM");
}
