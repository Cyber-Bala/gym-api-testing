import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { App } from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Auto update Service Worker to immediately serve the new UI bundle
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {},
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
