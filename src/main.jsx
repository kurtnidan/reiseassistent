
function showFatal(m){
  const r=document.getElementById('root'); if(!r) return;
  r.innerHTML = `<div style="padding:24px;font-family:system-ui;background:#fff7f7;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;margin:24px;">
    <h2 style="margin:0 0 8px 0;">⚠️ App error</h2>
    <pre style="white-space:pre-wrap;margin:0;">${String(m)}</pre>
  </div>`;
}
window.addEventListener('error', e=>showFatal(e.message||e.error||'Unknown error'));
window.addEventListener('unhandledrejection', e=>showFatal(e.reason||'Unknown promise error'));
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <ErrorBoundary><App /></ErrorBoundary>
  // </React.StrictMode>
)
