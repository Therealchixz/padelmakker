import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/variables.css'
import './responsive.css'
import { AuthProvider } from './lib/AuthContext'
import { initSentry } from './lib/sentry'
import { ErrorBoundary } from './ErrorBoundary'
import { DocumentHead } from './components/DocumentHead'
import { ScrollToTop } from './components/ScrollToTop'
import PadelMakker from './padelmakker-platform'

initSentry()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <DocumentHead />
        <AuthProvider>
          <PadelMakker />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
