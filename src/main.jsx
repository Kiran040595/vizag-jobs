import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.jsx'
import { AdminAuthProvider } from './context/AdminAuthContext.jsx'
import { EmployerAuthProvider } from './context/EmployerAuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AdminAuthProvider>
        <EmployerAuthProvider>
          <HelmetProvider>
            <App />
            <Analytics />
          </HelmetProvider>
        </EmployerAuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
