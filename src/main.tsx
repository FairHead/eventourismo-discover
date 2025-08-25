import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { BandProvider } from '@/contexts/BandContext'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BandProvider>
          <App />
        </BandProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)