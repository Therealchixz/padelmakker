import React from 'react'
import ReactDOM from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import './styles/variables.css'
import './responsive.css'
import { AuthProvider } from './lib/AuthContext'
import PadelMakker from './padelmakker-platform'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <PadelMakker />
      <SpeedInsights />
    </AuthProvider>
  </React.StrictMode>
)
