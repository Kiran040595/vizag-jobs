import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.jsx'
import { AdminAuthProvider } from './context/AdminAuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AdminAuthProvider>
        <HelmetProvider>
          <App />
          <Analytics />
        </HelmetProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
