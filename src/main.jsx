import React from 'react'
import ReactDOM from 'react-dom/client'
import './responsive.css'
import { AuthProvider } from './lib/AuthContext'
import PadelMakker from './padelmakker-platform'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <PadelMakker />
    </AuthProvider>
  </React.StrictMode>
)
