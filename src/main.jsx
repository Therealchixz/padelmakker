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
import { captureVisitSource } from './lib/visitSource.js'
import { reloadOnceForStaleChunk } from './lib/staleChunkReload.js'

initSentry()

// ?kilde=... fra et link i en mail eller en delt kamp: husk det, og fjern det
// fra adressen.
try {
  captureVisitSource(window.location, window.localStorage, window.history)
} catch {
  /* lageret kan være blokeret */
}

// En ny version er lagt ud, mens appen var åben: hent den nye version i stedet
// for at vise "Noget gik galt" (Vite sender vite:preloadError, når en kodefil mangler).
window.addEventListener('vite:preloadError', (event) => {
  let storage = null
  try {
    storage = window.sessionStorage
  } catch {
    /* lageret kan være blokeret */
  }
  if (reloadOnceForStaleChunk(event?.payload ?? 'Failed to fetch dynamically imported module', { storage, reload: () => window.location.reload() })) {
    event.preventDefault()
  }
})

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
