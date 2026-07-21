import {
  unregisterLegacyServiceWorkers,
  registerStaleAssetRecovery,
  registerPwaAutoUpdate,
} from './lib/pwaRecovery.js';

unregisterLegacyServiceWorkers();
registerStaleAssetRecovery();
registerPwaAutoUpdate();

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { AdminAuthProvider } from './context/AdminAuthContext.jsx'
import { EmployerAuthProvider } from './context/EmployerAuthContext.jsx'
import { StudentAuthProvider } from './context/StudentAuthContext.jsx'
import { CookieConsentProvider } from './context/CookieConsentContext.jsx'
import ConditionalAnalytics from './components/ConditionalAnalytics.jsx'
import ConditionalAdSense from './components/ConditionalAdSense.jsx'
import ToastViewport from './components/ToastViewport.jsx'
import ExternalApplyPromptHost from './components/ExternalApplyPromptHost.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AdminAuthProvider>
          <EmployerAuthProvider>
            <StudentAuthProvider>
              <CookieConsentProvider>
                <HelmetProvider>
                  <App />
                  <ToastViewport />
                  <ExternalApplyPromptHost />
                  <ConditionalAnalytics />
                  <ConditionalAdSense />
                </HelmetProvider>
              </CookieConsentProvider>
            </StudentAuthProvider>
          </EmployerAuthProvider>
        </AdminAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
