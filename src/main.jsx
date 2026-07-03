import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import { AdminAuthProvider } from './context/AdminAuthContext.jsx'
import { EmployerAuthProvider } from './context/EmployerAuthContext.jsx'
import { CookieConsentProvider } from './context/CookieConsentContext.jsx'
import ConditionalAnalytics from './components/ConditionalAnalytics.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AdminAuthProvider>
        <EmployerAuthProvider>
          <CookieConsentProvider>
            <HelmetProvider>
              <App />
              <ConditionalAnalytics />
            </HelmetProvider>
          </CookieConsentProvider>
        </EmployerAuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
