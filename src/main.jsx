import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { injectSpeedInsights } from '@vercel/speed-insights'
import './index.css'
import './styles/variables.css'
import './responsive.css'
import { AuthProvider } from './lib/AuthContext'
import { ErrorBoundary } from './ErrorBoundary'
import PadelMakker from './padelmakker-platform'

// Initialize Vercel Speed Insights
injectSpeedInsights()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <PadelMakker />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
